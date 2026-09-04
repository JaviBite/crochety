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

  const buffer = await epub(
    {
      title: options.title,
      author: "Crochety",
      lang: first?.language ?? "es",
      ...(options.cover ? { cover: options.cover } : {}),
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
