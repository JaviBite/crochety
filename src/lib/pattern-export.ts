// Exportación Markdown del patrón estandarizado + utilidades de nombre.
// Funciones PURAS, seguras para cliente y servidor (la descarga del Markdown
// se genera en el navegador). Los constructores EPUB están en el fichero
// .server.ts: epub-gen-memory arrastra ejs/fs y no debe entrar en el bundle
// de cliente.

import type { StandardizedPattern } from "@/lib/ai/standardize-pattern.shared";

/** Fila de ronda en Markdown; los pasos (kind "step") van en cursiva. */
function roundToMarkdown(round: StandardizedPattern["sections"][number]["rounds"][number]): string {
  if (round.kind === "step") {
    const label = round.label ? `${round.label}: ` : "";
    return `- *${label}${round.instruction}*`;
  }
  const count = round.stitchCount != null ? ` (${round.stitchCount})` : "";
  return `- **${round.label}**: ${round.instruction}${count}`;
}

export function toMarkdown(pattern: StandardizedPattern): string {
  const parts: string[] = [`# ${pattern.title}`];

  const meta: string[] = [];
  if (pattern.difficulty) meta.push(`**Dificultad:** ${pattern.difficulty}`);
  if (pattern.hookSizeMm != null) meta.push(`**Aguja:** ${pattern.hookSizeMm} mm`);
  if (meta.length) parts.push(meta.join(" · "));

  if (pattern.materials.length) {
    parts.push(
      ["## Materiales", "", ...pattern.materials.map((m) => `- ${m}`)].join("\n"),
    );
  }

  if (pattern.abbreviations.length) {
    parts.push(
      [
        "## Abreviaturas",
        "",
        "| Abbr. | Significado |",
        "| --- | --- |",
        ...pattern.abbreviations.map(
          (a) => `| ${a.abbr} | ${a.meaning} |`,
        ),
      ].join("\n"),
    );
  }

  for (const section of pattern.sections) {
    parts.push(
      [
        `## ${section.name}`,
        "",
        ...section.rounds.map(roundToMarkdown),
      ].join("\n"),
      section.notes ? `> ${section.notes}` : "",
    );
  }

  if (pattern.assemblyNotes) {
    parts.push(["## Montaje", "", pattern.assemblyNotes].join("\n"));
  }

  return parts.filter((part) => part !== "").join("\n\n");
}

/** Varios patrones en un único documento, separados por cortes horizontales. */
export function toMarkdownAll(patterns: StandardizedPattern[]): string {
  return patterns.map(toMarkdown).join("\n\n---\n\n");
}

/** "Patrón: Osito Bombero!" → "patron-osito-bombero" (para descargas). */
export function slugifyFileName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "patron";
}
