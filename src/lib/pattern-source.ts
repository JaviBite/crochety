import {
  saveUpload,
  readUpload,
} from "@/lib/files.server";
import {
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
 * OJO: no marcar el script JSD normal de Cloudflare
 * (/cdn-cgi/challenge-platform/scripts/jsd/main.js), presente en cualquier
 * sitio tras Cloudflare sin reto — solo los marcadores del reto real.
 */
export function looksLikeBotChallenge(html: string): boolean {
  return /cf_chl|orchestrate\/chl_page|Just a moment|Enable JavaScript (?:&|and) cookies/i.test(
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

// Proxy lector (Jina Reader): renderiza la página con un navegador real y
// devuelve el texto/markdown. Workaround para retos anti-bots sin montar un
// headless propio. Gratuito con rate limit; solo se usa si el fetch directo
// está bloqueado.
const READER_PROXY = "https://r.jina.ai/";
const PROXY_TIMEOUT_MS = 90_000;

async function fetchViaReaderProxy(url: string): Promise<string | null> {
  // Un reintento: el primer render de una página (en frío) puede agotar el
  // timeout; las siguientes salen de caché y son rápidas. SIN User-Agent de
  // navegador: r.jina.ai responde 403 a clientes suplantados.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(READER_PROXY + url, {
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      });
      if (res.ok) {
        const text = await res.text();
        if (text.trim()) return text.trim();
      }
    } catch {
      // Reintenta; si tampoco, null.
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 2_000));
  }
  return null;
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
  } else if (source.filePath?.endsWith(".html")) {
    // Página guardada desde el navegador ("Guardar como HTML"): el usuario ya
    // pasó el reto anti-bots, aquí solo hay que limpiar el HTML.
    const bytes = await uploadBytes(source.filePath);
    text = htmlToText(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
  } else if (source.externalUrl) {
    let html: string | null = null;
    try {
      const res = await fetchWithTimeout(source.externalUrl);
      const body = await res.text().catch(() => "");
      if (res.ok && !looksLikeBotChallenge(body)) {
        html = body;
      }
    } catch {
      html = null;
    }
    if (html) {
      text = htmlToText(html);
    } else {
      // Bloqueado (403, reto anti-bots o red): intenta el proxy lector antes
      // de rendirse — renderiza la página con navegador real y sortea el reto.
      const proxied = await fetchViaReaderProxy(source.externalUrl);
      if (!proxied) {
        throw new PatternSourceError(
          "La web bloquea la descarga automática (protección anti-bots). Sube el PDF del patrón o pega el texto.",
        );
      }
      text = proxied;
    }
  } else {
    throw new PatternSourceError("El patrón no tiene fichero ni enlace");
  }

  text = text.trim();
  if (!text) {
    throw new PatternSourceError("No se pudo extraer texto del patrón");
  }
  return text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;
}

// ---------------------------------------------------------------------------
// Contenido del origen para el LLM: texto "con pinta de patrón" o imágenes.
// Un PDF escaneado no da texto útil (vacío o basura sin "R1", "6 pb"…): en ese
// caso se rasterizan las páginas a buena resolución y se procesa por visión,
// igual que las imágenes subidas a mano.
// ---------------------------------------------------------------------------

export type ExtractedContent =
  | { type: "text"; text: string }
  | { type: "images"; images: string[] };

// Indicios de que un texto contiene un patrón de crochet: rondas numeradas,
// abreviaturas de puntos con conteo, anillo mágico o totales "(12)".
const PATTERN_TEXT_HINTS: RegExp[] = [
  /(?:^|\n)\s*(?:R\s*\d+|rnd\.?\s*\d+|ronda\s*\d+|round\s*\d+|row\.?\s*\d+|fila\s*\d+|vuelta\s*\d+)/i,
  /\b\d+\s*(?:pb|pa|pc|sc|dc|hdc|tr|dtr)\b/i,
  /\b(?:anillo m[áa]gico|magic (?:ring|circle)|amigurumi)\b/i,
  /\b(?:aum|dism|inc|dec|inv ?dec)\b/i,
  /\b\d+\s*[[(]\s*\d+\s*[\])]/,
];

/** Heurística: ¿este texto parece contener un patrón de crochet? */
export function looksLikePatternText(text: string): boolean {
  return PATTERN_TEXT_HINTS.some((re) => re.test(text));
}

// Escala de renderizado: x2 da páginas nítidas para que el modelo de visión
// lea las tablas de puntos sin disparar el peso de las imágenes.
const PDF_RENDER_SCALE = 2;
const MAX_RENDERED_PAGES = 10;

/**
 * Rasteriza las primeras páginas del PDF a data-URLs PNG (visión). Requiere
 * @napi-rs/canvas (binario precompilado); cualquier fallo se propaga y el
 * llamador decide (best-effort: si hay texto, se usa el texto).
 *
 * OJO: el documento debe crearse CON el CanvasFactory inyectado — si se pasa
 * un proxy ya creado, renderPageAsImage no lo reconfigura y el pdf.js interno
 * usa su stub que siempre lanza "@napi-rs/canvas is not available".
 */
export async function rasterizePdfPages(filePath: string): Promise<string[]> {
  const [
    { renderPageAsImage, getDocumentProxy, createIsomorphicCanvasFactory },
    bytes,
  ] = await Promise.all([
    import("unpdf"),
    uploadBytes(filePath),
  ]);
  const CanvasFactory = await createIsomorphicCanvasFactory(() =>
    import("@napi-rs/canvas"),
  );
  const pdf = await getDocumentProxy(bytes, { CanvasFactory });
  const dataUrls: string[] = [];
  for (let page = 1; page <= Math.min(pdf.numPages, MAX_RENDERED_PAGES); page++) {
    const dataUrl = await renderPageAsImage(pdf, page, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale: PDF_RENDER_SCALE,
      toDataURL: true,
    });
    dataUrls.push(dataUrl);
  }
  return dataUrls;
}

/**
 * Extrae el contenido del origen listo para el LLM:
 * 1. Imágenes del patrón → visión.
 * 2. Texto con indicios de patrón → texto.
 * 3. PDF cuyo texto no parece un patrón (escaneado) → páginas rasterizadas.
 *    Si el render falla pero hay texto, se envía el texto tal cual (mejor
 *    intentarlo que quedarse sin nada).
 */
export async function extractPatternContent(
  source: PatternSource,
): Promise<ExtractedContent> {
  if (source.imagePaths?.length) {
    return {
      type: "images",
      images: await loadPatternImages(source.imagePaths),
    };
  }

  if (source.filePath?.endsWith(".pdf")) {
    let text: string | null = null;
    try {
      text = await extractPatternText(source);
    } catch {
      // Sin texto utilizable (PDF escaneado): pasa al renderizado de páginas.
    }
    if (text && looksLikePatternText(text)) {
      return { type: "text", text };
    }
    let images: string[] = [];
    try {
      images = await rasterizePdfPages(source.filePath);
    } catch {
      images = [];
    }
    if (images.length) return { type: "images", images };
    if (text) return { type: "text", text };
    throw new PatternSourceError(
      "No se pudo leer el PDF (parece escaneado y falló el renderizado de páginas). Sube fotos del patrón o pega el texto.",
    );
  }

  const text = await extractPatternText(source);
  if (looksLikePatternText(text)) {
    return { type: "text", text };
  }
  throw new PatternSourceError(
    "El contenido no parece un patrón de crochet. Comprueba el enlace o el texto, o pega directamente el texto/fotos del patrón.",
  );
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
