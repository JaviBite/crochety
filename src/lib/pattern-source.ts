import {
  readUpload,
  saveUpload,
  EXT_TO_MIME,
  IMAGE_MIME_TO_EXT,
} from "@/lib/files";

// ---------------------------------------------------------------------------
// Origen del patrón (fichero subido o enlace externo) → texto para la IA y
// portada derivada. Solo servidor. Las dependencias pesadas (unpdf, mammoth,
// fast-png) se importan bajo demanda para no cargarlas si no se usan.
// ---------------------------------------------------------------------------

export type PatternSource = {
  filePath: string | null;
  externalUrl: string | null;
  /** Pathnames de imágenes que la IA lee por visión (fuente alternativa). */
  imagePaths?: string[] | null;
};

/** Columna Pattern.imagePaths (JSON string) → lista de pathnames válidos. */
export function parseImagePaths(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((p): p is string => typeof p === "string")
      : [];
  } catch {
    return [];
  }
}

/** Imágenes del patrón como data-URLs, listas para pasar al modelo de visión. */
export async function loadPatternImages(paths: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const relPath of paths) {
    const ext = relPath.slice(relPath.lastIndexOf(".")).toLowerCase();
    const mime = EXT_TO_MIME[ext];
    if (!mime || !(mime in IMAGE_MIME_TO_EXT)) continue;
    const bytes = await uploadBytes(relPath);
    out.push(`data:${mime};base64,${Buffer.from(bytes).toString("base64")}`);
  }
  if (out.length === 0) {
    throw new PatternSourceError("No se pudieron leer las imágenes del patrón");
  }
  return out;
}

/** Error con mensaje apto para mostrar al usuario. */
export class PatternSourceError extends Error {}

// Tope de texto que se envía al LLM (~15k tokens): los patrones reales caben
// de sobra; protege de páginas web enormes.
const MAX_TEXT_CHARS = 60_000;

// Cabeceras de navegador: muchas webs (WordPress, blogs de patrones) devuelven
// 403 a agentes no-navegador. No basta contra retos JS de Cloudflare, pero sí
// desbloquea la mayoría.
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Detecta la página intermedia de un reto anti-bots (Cloudflare "Just a
 * moment", etc.): un fetch de servidor no ejecuta JS y no puede superarlo.
 */
export function looksLikeBotChallenge(html: string): boolean {
  return /cf_chl|challenge-platform|Just a moment|Enable JavaScript (?:&|and) cookies/i.test(
    html,
  );
}

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
    const html = await res.text();
    if (looksLikeBotChallenge(html)) {
      throw new PatternSourceError(
        "La web bloquea la descarga automática (protección anti-bots). Sube el PDF del patrón o pega el texto.",
      );
    }
    text = htmlToText(html);
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

// ---------------------------------------------------------------------------
// Selector de portada: se extraen TODAS las imágenes candidatas del origen y
// se muestran para que el usuario elija (la automática a veces no acierta).
// Las candidatas viajan como `src` autoexplicativo: data-URL (imágenes del
// PDF) o URL remota (imágenes de la web). Nada se guarda hasta que se elige
// una — así no quedan ficheros huérfanos.
// ---------------------------------------------------------------------------

const MAX_COVER_CANDIDATES = 12;
const CANDIDATE_PAGES = 8;

// Trozos de URL típicos de imágenes que NO son fotos del patrón (logos, iconos…).
const JUNK_IMAGE_HINT = /logo|icon|avatar|gravatar|sprite|emoji|pixel|badge/i;

/**
 * URLs de imágenes candidatas de una página HTML: og:image primero, luego los
 * <img> (src y primera entrada de srcset), resueltas a absolutas, sin
 * duplicados ni basura evidente (data:, svg, logos/iconos).
 */
export function collectHtmlImageUrls(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const trimmed = raw?.trim();
    if (!trimmed || trimmed.startsWith("data:")) return;
    let resolved: string;
    try {
      resolved = new URL(trimmed, baseUrl).href;
    } catch {
      return;
    }
    if (/\.svg(\?|$)/i.test(resolved) || JUNK_IMAGE_HINT.test(resolved)) return;
    urls.add(resolved);
  };

  add(findOgImage(html));
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    add(tag.match(/\bsrc=["']([^"']+)["']/i)?.[1]);
    const srcset = tag.match(/\bsrcset=["']([^"']+)["']/i)?.[1];
    if (srcset) add(srcset.split(",")[0]?.trim().split(/\s+/)[0]);
  }
  return [...urls].slice(0, MAX_COVER_CANDIDATES);
}

async function pdfImageCandidates(filePath: string): Promise<string[]> {
  const [{ extractImages, getDocumentProxy }, { encode }, bytes] =
    await Promise.all([
      import("unpdf"),
      import("fast-png"),
      uploadBytes(filePath),
    ]);
  const pdf = await getDocumentProxy(bytes);

  const found: { area: number; dataUrl: string }[] = [];
  for (let page = 1; page <= Math.min(pdf.numPages, CANDIDATE_PAGES); page++) {
    for (const img of await extractImages(pdf, page)) {
      if (img.width < MIN_COVER_SIDE || img.height < MIN_COVER_SIDE) continue;
      const png = encode({
        width: img.width,
        height: img.height,
        data: new Uint8Array(
          img.data.buffer,
          img.data.byteOffset,
          img.data.byteLength,
        ),
        channels: img.channels,
      });
      found.push({
        area: img.width * img.height,
        dataUrl: `data:image/png;base64,${Buffer.from(png).toString("base64")}`,
      });
    }
    if (found.length >= MAX_COVER_CANDIDATES) break;
  }
  // Mayores primero (las fotos del amigurumi suelen ser las más grandes).
  found.sort((a, b) => b.area - a.area);
  return found.slice(0, MAX_COVER_CANDIDATES).map((entry) => entry.dataUrl);
}

/** Imágenes candidatas a portada del origen (data-URLs del PDF o URLs web). */
export async function collectCoverCandidates(
  source: PatternSource,
): Promise<string[]> {
  try {
    if (source.filePath?.endsWith(".pdf")) {
      return await pdfImageCandidates(source.filePath);
    }
    if (source.externalUrl) {
      const res = await fetchWithTimeout(source.externalUrl);
      if (!res.ok) return [];
      return collectHtmlImageUrls(await res.text(), source.externalUrl);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Guarda como portada la candidata elegida: decodifica el data-URL (PDF) o
 * descarga la URL remota (web), valida que sea una imagen y la sube.
 */
export async function saveChosenCover(src: string): Promise<string> {
  if (src.startsWith("data:")) {
    const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(src);
    if (!match || !(match[1] in IMAGE_MIME_TO_EXT)) {
      throw new PatternSourceError("Imagen de portada inválida");
    }
    const file = new File([Buffer.from(match[2], "base64")], "cover", {
      type: match[1],
    });
    return saveUpload("patterns", file);
  }

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    throw new PatternSourceError("Imagen de portada inválida");
  }
  let res: Response;
  try {
    res = await fetchWithTimeout(url.href);
  } catch {
    throw new PatternSourceError("No se pudo descargar la imagen");
  }
  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!res.ok || !(mime in IMAGE_MIME_TO_EXT)) {
    throw new PatternSourceError("No se pudo descargar la imagen");
  }
  const file = new File([await res.arrayBuffer()], "cover", { type: mime });
  return saveUpload("patterns", file);
}
