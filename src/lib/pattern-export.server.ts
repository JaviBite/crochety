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

/**
 * Normaliza la portada al formato de portada de libro: 1600×2560 con recorte
 * centrado ("cover fit") y JPEG q85 para que el EPUB la lleve ligera.
 * Si algo falla (canvas no disponible, imagen corrupta) se usa la original.
 */
export async function normalizeCoverFile(cover: File): Promise<File> {
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const bytes = new Uint8Array(await cover.arrayBuffer());
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
  return new Uint8Array(buffer);
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
