// Tipos y funciones compartidas para estandarización de patrones.
// Sin dependencias de servidor (ni AI, ni Prisma) — seguro para usar en Client Components.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Contrato del patrón estandarizado.
// La UI renderiza SIEMPRE este JSON de la misma forma, venga de donde venga
// el patrón original. Se guarda serializado en Pattern.standardizedContent.
// ---------------------------------------------------------------------------

export const standardizedPatternSchema = z.object({
  title: z.string().describe("Título del patrón"),
  language: z.enum(["es", "en"]).describe("Idioma del patrón estandarizado"),
  difficulty: z.enum(["principiante", "intermedio", "avanzado"]).nullable(),
  hookSizeMm: z.number().nullable().describe("Tamaño de aguja en mm"),
  materials: z
    .array(z.string())
    .describe("Materiales necesarios, un elemento por material"),
  abbreviations: z
    .array(z.object({ abbr: z.string(), meaning: z.string() }))
    .describe("Abreviaturas usadas y su significado (pb, aum, dism...)"),
  sections: z
    .array(
      z.object({
        name: z.string().describe("Parte de la pieza: cabeza, cuerpo, brazo…"),
        rounds: z.array(
          z.object({
            label: z
              .string()
              .describe('Etiqueta de la ronda/fila, p. ej. "R1" o "R4-R7"'),
            instruction: z
              .string()
              .describe('Instrucción normalizada, p. ej. "6 pb en anillo mágico"'),
            stitchCount: z
              .number()
              .nullable()
              .describe("Total de puntos al acabar la ronda, si se conoce"),
            kind: z
              .enum(["round", "step"])
              .nullish()
              .describe(
                'Ronda normal de puntos ("round", default) o instrucción '
                  + 'intercalada sin conteo ("step": añadir ojos, rellenar, '
                  + "cortar hilo, cambiar de color…)",
              ),
          }),
        ),
        notes: z.string().nullable(),
      }),
    )
    .describe("Secciones del patrón en orden de trabajo"),
  assemblyNotes: z.string().nullable().describe("Montaje y acabado"),
});

export type StandardizedPattern = z.infer<typeof standardizedPatternSchema>;

/**
 * Contrato de una estandarización: un origen (PDF, web, imágenes…) puede
 * contener VARIOS patrones. Es lo que el LLM devuelve y lo que se guarda
 * cuando hay más de uno ({ patterns: [...] }) para que el usuario decida.
 */
export const standardizedPatternsSchema = z.object({
  patterns: z
    .array(standardizedPatternSchema)
    .describe("Todos los patrones detectados en el contenido, en orden"),
});

export type StandardizedPatterns = z.infer<typeof standardizedPatternsSchema>;

/** Tope de patrones que se aceptan de una sola estandarización. */
export const MAX_PATTERNS_PER_CALL = 10;

/** Un patrón sin rondas, materiales ni montaje no aporta nada (ruido del LLM). */
function hasContent(pattern: StandardizedPattern): boolean {
  return (
    pattern.sections.some((section) => section.rounds.length > 0) ||
    pattern.materials.length > 0 ||
    pattern.assemblyNotes != null
  );
}

/** Quita abreviaturas repetidas (el LLM las repite a menudo entre secciones). */
function dedupeAbbreviations(
  abbreviations: StandardizedPattern["abbreviations"],
): StandardizedPattern["abbreviations"] {
  const seen = new Map<string, StandardizedPattern["abbreviations"][number]>();
  for (const entry of abbreviations) {
    const key = entry.abbr.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.set(key, {
        abbr: entry.abbr.trim().toLowerCase(),
        meaning: entry.meaning.trim(),
      });
    }
  }
  return [...seen.values()];
}

/** Normaliza un patrón estandarizado: trimea, deduplica y filtra. */
export function normalizeStandardizedPattern(
  pattern: StandardizedPattern,
): StandardizedPattern {
  return {
    ...pattern,
    title: pattern.title.trim(),
    materials: pattern.materials.map((material) => material.trim()).filter(Boolean),
    abbreviations: dedupeAbbreviations(
      pattern.abbreviations
        .map((entry) => ({
          abbr: entry.abbr.trim(),
          meaning: entry.meaning.trim(),
        }))
        .filter((entry) => entry.abbr || entry.meaning),
    ),
    sections: pattern.sections
      .map((section) => ({
        name: section.name.trim(),
        notes: section.notes?.trim() || null,
        rounds: section.rounds
          .map((round) => ({
            label: round.label.trim(),
            instruction: round.instruction.trim(),
            stitchCount: round.stitchCount,
            kind: round.kind === "step" ? ("step" as const) : undefined,
          }))
          .filter((round) => round.label || round.instruction),
      }))
      .filter((section) => section.name || section.rounds.length > 0),
    assemblyNotes: pattern.assemblyNotes?.trim() || null,
  };
}

/**
 * Normaliza una lista de patrones detectados: normaliza cada uno, descarta los
 * vacíos (el LLM a veces devuelve relleno) y aplica el tope por llamada.
 */
export function normalizeStandardizedPatterns(
  patterns: StandardizedPattern[],
): StandardizedPattern[] {
  return patterns
    .map(normalizeStandardizedPattern)
    .filter(hasContent)
    .slice(0, MAX_PATTERNS_PER_CALL);
}

/** JSON persistido → contrato tipado; null si no hay o no valida (corrupto). */
export function parseStandardizedContent(
  raw: string | null,
): StandardizedPattern | null {
  if (!raw) return null;
  try {
    const parsed = standardizedPatternSchema.safeParse(JSON.parse(raw));
    return parsed.success ? normalizeStandardizedPattern(parsed.data) : null;
  } catch {
    return null;
  }
}

/**
 * JSON persistido → lista de patrones. Acepta el formato multi-patrón
 * ({ patterns: [...] }), un array plano o un patrón único (formato legado de
 * los patrones ya guardados, que se envuelve en una lista de uno).
 */
export function parseStandardizedPatternsContent(
  raw: string | null | undefined,
): StandardizedPattern[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (Array.isArray(parsed)) {
    const items = parsed
      .map((item) => standardizedPatternSchema.safeParse(item))
      .filter((entry) => entry.success)
      .map((entry) => entry.data);
    return normalizeStandardizedPatterns(items);
  }

  const wrapped = standardizedPatternsSchema.safeParse(parsed);
  if (wrapped.success) {
    return normalizeStandardizedPatterns(wrapped.data.patterns);
  }
  const single = standardizedPatternSchema.safeParse(parsed);
  return single.success ? normalizeStandardizedPatterns([single.data]) : [];
}

/** Esqueleto vacío para escribir un patrón a mano en el editor online. */
export function emptyStandardizedPattern(title: string): StandardizedPattern {
  return {
    title,
    language: "es",
    difficulty: null,
    hookSizeMm: null,
    materials: [],
    abbreviations: [],
    sections: [{ name: "", rounds: [], notes: null }],
    assemblyNotes: null,
  };
}
