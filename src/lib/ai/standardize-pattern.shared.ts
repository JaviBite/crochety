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
 * vacíos (el LLM a veces devuelve relleno), elimina duplicados exactos y aplica
 * el tope por llamada.
 */
export function normalizeStandardizedPatterns(
  patterns: StandardizedPattern[],
): StandardizedPattern[] {
  return dedupeIdenticalPatterns(
    patterns.map(normalizeStandardizedPattern).filter(hasContent),
  ).slice(0, MAX_PATTERNS_PER_CALL);
}

/** Título comparable: minúsculas, sin paréntesis ni signos ("Med. (2)" → "med"). */
function comparableTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();
}

/** Huella de contenido: título + todas las rondas, para detectar copias. */
function patternFingerprint(pattern: StandardizedPattern): string {
  const rounds = pattern.sections
    .map((section) =>
      section.rounds
        .map((round) => `${round.label}|${round.instruction}`)
        .join(";"),
    )
    .join("#");
  return `${comparableTitle(pattern.title)}#${pattern.sections.length}#${rounds}`;
}

/**
 * Quita duplicados EXACTOS (mismo título y mismas rondas): los modelos a
 * veces repiten el mismo patrón en la segmentación de recopilatorios.
 * Variantes con igual título pero contenido distinto se conservan.
 */
export function dedupeIdenticalPatterns(
  patterns: StandardizedPattern[],
): StandardizedPattern[] {
  const seen = new Set<string>();
  return patterns.filter((pattern) => {
    const key = patternFingerprint(pattern);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * ¿La segmentación ha "inventado" varios patrones a partir de uno? Señal:
 * ≥3 patrones y UN SOLO título distinto entre todos (el mismo texto troceado
 * N veces). Los recopilatorios reales tienen títulos diferentes.
 */
export function looksLikeDuplicateSplit(
  patterns: StandardizedPattern[],
): boolean {
  if (patterns.length < 3) return false;
  const titles = new Set(patterns.map((p) => comparableTitle(p.title)));
  return titles.size <= 1;
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

// --------------------------------------------------------------------------
// Reparación de respuestas de LLM flacos: los modelos gratuitos devuelven a
// ratos el JSON envuelto en texto ("```json …```", frases antes o después)
// o truncado. `repairText` de la AI SDK recibe la respuesta cruda y esta
// helper intenta salvarla; null si no hay nada rescatable.
// --------------------------------------------------------------------------

/** Índice del cierre que balancea el primer carácter de apertura, o menos uno. */
function balancedCloseIndex(text: string): number {
  const pairs: Record<string, string> = { "{": "}", "[": "]" };
  const stack: string[] = [];
  let insideString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (insideString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') insideString = false;
      continue;
    }
    if (ch === '"') insideString = true;
    else if (ch in pairs) stack.push(pairs[ch]);
    else if (ch === "}" || ch === "]") {
      if (stack.pop() !== ch) return -1;
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

/** Pilas de apertura de un JSON (ignora strings) — para cerrar al truncar. */
function openStack(text: string): string[] {
  const stack: string[] = [];
  let insideString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (insideString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') insideString = false;
      continue;
    }
    if (ch === '"') insideString = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if ((ch === "}" && stack[stack.length - 1] === "{")
      || (ch === "]" && stack[stack.length - 1] === "[")) {
      stack.pop();
    }
  }
  return stack;
}

/** Índice del último cierre COMPLETO de un elemento (puntos donde truncar). */
function lastCompleteClose(text: string): number {
  const stack: string[] = [];
  let insideString = false;
  let escaped = false;
  let lastComplete = -1;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (insideString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') insideString = false;
      continue;
    }
    if (ch === '"') insideString = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if ((ch === "}" && stack[stack.length - 1] === "{")
      || (ch === "]" && stack[stack.length - 1] === "[")) {
      stack.pop();
      lastComplete = i;
    }
  }
  return lastComplete;
}

/** Cierra las estructuras abiertas de un JSON truncado (mejor esfuerzo).
    Trunca tras el último elemento COMPLETO y cierra lo que quedó abierto. */
function closeBrokenJson(text: string): string {
  const cut = text.slice(0, lastCompleteClose(text) + 1).replace(/,\s*$/, "");
  let result = cut;
  for (const open of openStack(cut).reverse()) {
    result += open === "{" ? "}" : "]";
  }
  return result;
}

/**
 * Salva una respuesta de LLM que debería ser JSON: quita cercos de markdown,
 * texto antes/después del objeto y cierra JSON truncados. Devuelve el JSON
 * completo parseable como texto, o null si no hay nada rescatable.
 */
export function repairPatternJson(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();

  // Solo los contenidos que deben empezar por objeto o lista: fuera el ruido.
  const firstBrace = s.search(/[{[]/);
  if (firstBrace < 0) return null;
  s = s.slice(firstBrace);

  const closeIndex = balancedCloseIndex(s);
  if (closeIndex >= 0) s = s.slice(0, closeIndex + 1);
  else s = closeBrokenJson(s);

  try {
    JSON.parse(s);
    return s;
  } catch {
    return null;
  }
}
