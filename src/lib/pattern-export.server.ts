// Exportación EPUB del patrón estandarizado. SOLO SERVIDOR:
// epub-gen-memory arrastra ejs (que usa fs de Node) y no debe entrar nunca en
// el bundle de cliente; las funciones puras (Markdown) viven en
// pattern-export.ts. epub-gen-memory se importa bajo demanda.

import "server-only";

import type { StandardizedPattern } from "@/lib/ai/standardize-pattern.shared";

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sectionHtml(
  section: StandardizedPattern["sections"][number],
): string {
  const items = section.rounds
    .map((round) => {
      if (round.kind === "step") {
        const label = round.label ? `${esc(round.label)}: ` : "";
        return `<li><em>${label}${esc(round.instruction)}</em></li>`;
      }
      const count =
        round.stitchCount != null ? ` (${round.stitchCount})` : "";
      return `<li><strong>${esc(round.label)}</strong>: ${esc(round.instruction)}${count}</li>`;
    })
    .join("");
  return `<h2>${esc(section.name)}</h2><ol>${items}</ol>${
    section.notes ? `<p><em>${esc(section.notes)}</em></p>` : ""
  }`;
}

function metaHtml(pattern: StandardizedPattern): string {
  const parts: string[] = [];
  if (pattern.materials.length) {
    parts.push(
      `<h2>Materiales</h2><ul>${pattern.materials
        .map((m) => `<li>${esc(m)}</li>`)
        .join("")}</ul>`,
    );
  }
  if (pattern.abbreviations.length) {
    parts.push(
      `<h2>Abreviaturas</h2><table><thead><tr><th>Abbr.</th><th>Significado</th></tr></thead><tbody>${pattern.abbreviations
        .map(
          (a) => `<tr><td>${esc(a.abbr)}</td><td>${esc(a.meaning)}</td></tr>`,
        )
        .join("")}</tbody></table>`,
    );
  }
  return parts.join("");
}

function assemblyHtml(pattern: StandardizedPattern): string {
  return pattern.assemblyNotes
    ? `<h2>Montaje</h2><p>${esc(pattern.assemblyNotes)}</p>`
    : "";
}

function fullPatternHtml(pattern: StandardizedPattern): string {
  const meta: string[] = [];
  if (pattern.difficulty) meta.push(esc(pattern.difficulty));
  if (pattern.hookSizeMm != null) meta.push(`${pattern.hookSizeMm} mm`);
  return `${meta.length ? `<p><em>${meta.join(" · ")}</em></p>` : ""}${metaHtml(pattern)}${pattern.sections
    .map(sectionHtml)
    .join("")}${assemblyHtml(pattern)}`;
}

// Tamaño estándar de portada de libro (ratio 2:3.2, el que usan Kindle/EPUB).
const COVER_WIDTH = 1600;
const COVER_HEIGHT = 2560;

/** ¿Parece una imagen que el canvas pueda decodificar? (firma + tamaño). */
function plausibleImage(bytes: Uint8Array): boolean {
  if (bytes.length < 32) return false;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const webp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46;
  const gif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
  return jpeg || (png && bytes.length > 32) || webp || gif;
}

/**
 * Normaliza la portada al formato de portada de libro: 1600×2560 con recorte
 * centrado ("cover fit") y JPEG q85 para que el EPUB la lleve ligera.
 * Si algo falla (canvas no disponible, imagen corrupta) se usa la original.
 * OJO: @napi-rs/canvas puede CASCAR nativamente con datos corruptos (el
 * try/catch no salva el proceso); por eso se filtran antes con plausibleImage.
 */
export async function normalizeCoverFile(cover: File): Promise<File> {
  try {
    const bytes = new Uint8Array(await cover.arrayBuffer());
    if (!plausibleImage(bytes)) return cover;
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const image = await loadImage(bytes);
    const canvas = createCanvas(COVER_WIDTH, COVER_HEIGHT);
    const ctx = canvas.getContext("2d");
    const scale = Math.max(
      COVER_WIDTH / image.width,
      COVER_HEIGHT / image.height,
    );
    const width = image.width * scale;
    const height = image.height * scale;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
    ctx.drawImage(
      image,
      (COVER_WIDTH - width) / 2,
      (COVER_HEIGHT - height) / 2,
      width,
      height,
    );
    const jpeg = await canvas.encode("jpeg", 85);
    return new File([jpeg as BlobPart], "cover.jpg", { type: "image/jpeg" });
  } catch {
    return cover;
  }
}

type EpubOptions = {
  title: string;
  patterns: StandardizedPattern[];
  /** Portada opcional ya resuelta a File (bytes + nombre con extensión). */
  cover?: File;
  /** true = un capítulo por sección del patrón (patrón único). */
  perSectionChapters?: boolean;
};

/**
 * Primera página del EPUB: la portada a pantalla completa (el libro abre con
 * ella "en grande", además de llevarla como metadato de portada).
 *
 * epub-gen-memory solo escribe `OEBPS/cover.<ext>` (metadato, sin página) y
 * las <img> del contenido las descarga con node-fetch (sin data: ni rutas
 * locales): por eso esta página se inserta a mano en el ZIP referenciando el
 * propio fichero cover.<ext> relativo, y se añade como PRIMER item del spine.
 */
async function withCoverPage(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(bytes);
    const opfFile = zip.file("OEBPS/content.opf");
    if (!opfFile) return bytes;

    const opf = await opfFile.async("string");
    // El cover real que escribió la lib (href="cover.<ext>" en el OPF).
    const coverHref = /<item[^>]*href="(cover\.[^"]+)"/.exec(opf)?.[1];
    if (!coverHref) return bytes;

    zip.file(
      "OEBPS/cover-page.xhtml",
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Portada</title></head>
<body>
  <div style="text-align: center; margin: 0; padding: 0;">
    <img src="${coverHref}" style="max-width: 100%; max-height: 100%;"/>
  </div>
</body>
</html>`,
    );

    // El mimetype debe seguir comprimido con STORE (requisito EPUB).
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file(
      "OEBPS/content.opf",
      opf
        .replace(
          "</manifest>",
          '  <item id="cover-page" href="cover-page.xhtml" media-type="application/xhtml+xml"/>\n</manifest>',
        )
        .replace(
          /(<spine[^>]*>)/,
          '$1\n  <itemref idref="cover-page"/>',
        ),
    );

    const out = await zip.generateAsync({ type: "uint8array" });
    return out;
  } catch {
    // Best-effort: si el post-proceso falla, el EPUB queda sin la página.
    return bytes;
  }
}

async function buildEpub(options: EpubOptions): Promise<Uint8Array> {
  const { default: epub } = await import("epub-gen-memory");
  const first = options.patterns[0];

  const chapters: { title: string; content: string }[] =
    options.perSectionChapters && first
      ? [
          ...(metaHtml(first)
            ? [{ title: "Materiales y abreviaturas", content: metaHtml(first) }]
            : []),
          ...first.sections.map((section) => ({
            title: section.name,
            content: sectionHtml(section),
          })),
          ...(first.assemblyNotes
            ? [
                {
                  title: "Montaje",
                  content: assemblyHtml(first),
                },
              ]
            : []),
        ]
      : options.patterns.map((pattern, index) => ({
          title: pattern.title || `Patrón ${index + 1}`,
          content: fullPatternHtml(pattern),
        }));

  const cover = options.cover
    ? await normalizeCoverFile(options.cover)
    : undefined;

  const buffer = await epub(
    {
      title: options.title,
      author: "Crochety",
      lang: first?.language ?? "es",
      ...(cover ? { cover } : {}),
    },
    chapters,
  );
  return cover
    ? withCoverPage(new Uint8Array(buffer))
    : new Uint8Array(buffer);
}

/** EPUB de un patrón: un capítulo por sección, con portada opcional. */
export function toEpub(
  pattern: StandardizedPattern,
  cover?: File,
): Promise<Uint8Array> {
  return buildEpub({
    title: pattern.title,
    patterns: [pattern],
    cover,
    perSectionChapters: true,
  });
}

/** EPUB recopilatorio: un capítulo por patrón (para detecciones múltiples). */
export function toEpubAnthology(
  patterns: StandardizedPattern[],
  cover?: File,
): Promise<Uint8Array> {
  const title =
    patterns.length === 1
      ? patterns[0].title
      : "Patrones de crochet · Crochety";
  return buildEpub({ title, patterns, cover, perSectionChapters: false });
}
