import { readUpload, saveUpload, IMAGE_MIME_TO_EXT } from "@/lib/files";

// ---------------------------------------------------------------------------
// Origen del patrón (fichero subido o enlace externo) → texto para la IA y
// portada derivada. Solo servidor. Las dependencias pesadas (unpdf, mammoth,
// fast-png) se importan bajo demanda para no cargarlas si no se usan.
// ---------------------------------------------------------------------------

export type PatternSource = {
  filePath: string | null;
  externalUrl: string | null;
};

/** Error con mensaje apto para mostrar al usuario. */
export class PatternSourceError extends Error {}

// Tope de texto que se envía al LLM (~15k tokens): los patrones reales caben
// de sobra; protege de páginas web enormes.
const MAX_TEXT_CHARS = 60_000;

const FETCH_HEADERS = { "User-Agent": "crochety/1.0 (+pattern import)" };
const FETCH_TIMEOUT_MS = 15_000;

async function uploadBytes(relPath: string): Promise<Uint8Array> {
  const content = await readUpload(relPath);
  if (!content) {
    throw new PatternSourceError("No se encontró el fichero del patrón");
  }
  if (content instanceof Uint8Array) return content;
  return new Uint8Array(await new Response(content).arrayBuffer());
}

/**
 * Reducción de HTML a texto plano legible: fuera scripts/estilos, los cierres
 * de bloque se convierten en saltos de línea y se decodifican las entidades
 * más comunes. Suficiente para alimentar al LLM sin dependencias extra.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|head|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** URL de la meta og:image (o og:image:secure_url), venga en el orden que venga. */
export function findOgImage(html: string): string | null {
  const meta = html.match(
    /<meta\b[^>]*(?:property|name)=["']og:image(?::secure_url)?["'][^>]*>/i,
  )?.[0];
  if (!meta) return null;
  return meta.match(/content=["']([^"']+)["']/i)?.[1] ?? null;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

/**
 * Extrae el texto crudo del origen del patrón: PDF con unpdf, DOCX con
 * mammoth, página web con fetch + htmlToText. Lanza PatternSourceError con
 * mensaje mostrable si no hay origen o no se pudo sacar texto.
 */
export async function extractPatternText(source: PatternSource): Promise<string> {
  let text: string;

  if (source.filePath?.endsWith(".pdf")) {
    const [{ extractText, getDocumentProxy }, bytes] = await Promise.all([
      import("unpdf"),
      uploadBytes(source.filePath),
    ]);
    const pdf = await getDocumentProxy(bytes);
    text = (await extractText(pdf, { mergePages: true })).text;
  } else if (source.filePath?.endsWith(".docx")) {
    const [{ default: mammoth }, bytes] = await Promise.all([
      import("mammoth"),
      uploadBytes(source.filePath),
    ]);
    text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
  } else if (source.externalUrl) {
    let res: Response;
    try {
      res = await fetchWithTimeout(source.externalUrl);
    } catch {
      throw new PatternSourceError("No se pudo descargar la página del patrón");
    }
    if (!res.ok) {
      throw new PatternSourceError("No se pudo descargar la página del patrón");
    }
    text = htmlToText(await res.text());
  } else {
    throw new PatternSourceError("El patrón no tiene fichero ni enlace");
  }

  text = text.trim();
  if (!text) {
    throw new PatternSourceError("No se pudo extraer texto del patrón");
  }
  return text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;
}

// Una portada tiene que ser una imagen "de verdad", no un icono o separador.
const MIN_COVER_SIDE = 200;

/** La imagen candidata a portada: la más grande que supere el tamaño mínimo. */
export function pickCoverImage<T extends { width: number; height: number }>(
  images: T[],
): T | null {
  const candidates = images
    .filter((img) => img.width >= MIN_COVER_SIDE && img.height >= MIN_COVER_SIDE)
    .sort((a, b) => b.width * b.height - a.width * a.height);
  return candidates[0] ?? null;
}

// La portada suele estar en la primera página, pero no siempre: se miran
// las primeras páginas hasta encontrar una imagen decente.
const MAX_COVER_PAGES = 3;

async function coverFromPdf(filePath: string): Promise<string | null> {
  const [{ extractImages, getDocumentProxy }, bytes] = await Promise.all([
    import("unpdf"),
    uploadBytes(filePath),
  ]);
  const pdf = await getDocumentProxy(bytes);

  let cover: Awaited<ReturnType<typeof extractImages>>[number] | null = null;
  for (let page = 1; page <= Math.min(pdf.numPages, MAX_COVER_PAGES); page++) {
    cover = pickCoverImage(await extractImages(pdf, page));
    if (cover) break;
  }
  if (!cover) return null;

  const { encode } = await import("fast-png");
  const png = encode({
    width: cover.width,
    height: cover.height,
    data: new Uint8Array(cover.data.buffer, cover.data.byteOffset, cover.data.byteLength),
    channels: cover.channels,
  });
  const file = new File([png as BlobPart], "cover.png", { type: "image/png" });
  return saveUpload("patterns", file);
}

async function coverFromWeb(externalUrl: string): Promise<string | null> {
  const pageRes = await fetchWithTimeout(externalUrl);
  if (!pageRes.ok) return null;
  const ogImage = findOgImage(await pageRes.text());
  if (!ogImage) return null;

  const imageRes = await fetchWithTimeout(new URL(ogImage, externalUrl).href);
  const mime = imageRes.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!imageRes.ok || !(mime in IMAGE_MIME_TO_EXT)) return null;

  const file = new File([await imageRes.arrayBuffer()], "cover", { type: mime });
  return saveUpload("patterns", file);
}

/**
 * Deriva la portada del origen cuando no se subió una: la imagen más grande de
 * la primera página del PDF, o la og:image de la página enlazada. Best-effort:
 * cualquier fallo devuelve null y el patrón se queda sin portada.
 */
export async function derivePatternCover(
  source: PatternSource,
): Promise<string | null> {
  try {
    if (source.filePath?.endsWith(".pdf")) {
      return await coverFromPdf(source.filePath);
    }
    if (source.externalUrl) {
      return await coverFromWeb(source.externalUrl);
    }
    return null;
  } catch {
    return null;
  }
}
