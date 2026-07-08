import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "./provider";

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
          }),
        ),
        notes: z.string().nullable(),
      }),
    )
    .describe("Secciones del patrón en orden de trabajo"),
  assemblyNotes: z.string().nullable().describe("Montaje y acabado"),
});

export type StandardizedPattern = z.infer<typeof standardizedPatternSchema>;

/** JSON persistido → contrato tipado; null si no hay o no valida (corrupto). */
export function parseStandardizedContent(
  raw: string | null,
): StandardizedPattern | null {
  if (!raw) return null;
  try {
    const parsed = standardizedPatternSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
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

const SYSTEM_PROMPT = `Eres un experto en patrones de crochet y amigurumi.
Recibirás el texto extraído de un patrón (de un PDF, DOCX o página web) que
puede venir en cualquier idioma y con cualquier formato o notación.

Tu tarea es estandarizarlo al esquema JSON indicado, en español y con la
notación española habitual (pb = punto bajo, aum = aumento, dism = disminución,
pa = punto alto, am = anillo mágico). Conserva fielmente los números de
puntos y repeticiones: no inventes rondas ni omitas ninguna. Si un dato no
aparece en el original, usa null.`;

/**
 * Agente de estandarización: texto crudo del patrón → JSON estandarizado.
 */
export async function standardizePattern(
  rawText: string,
): Promise<StandardizedPattern> {
  const { object } = await generateObject({
    model: await getModel(),
    schema: standardizedPatternSchema,
    system: SYSTEM_PROMPT,
    prompt: rawText,
  });
  return object;
}

const MIXED_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

El patrón puede llegar como texto (pegado a mano o extraído de un PDF/DOCX/
web), como una o varias IMÁGENES (fotos o capturas de páginas), o ambos a la
vez. Lee también el texto y las tablas de puntos que aparezcan en las
imágenes. Si hay varias imágenes, trátalas como páginas consecutivas de un
único patrón, en el orden dado.`;

type UserContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string };

/**
 * Estandariza un patrón a partir de texto y/o imágenes (data URLs). Requiere
 * un modelo con visión si se pasan imágenes (el mismo que usa la extracción
 * de gastos).
 */
export async function standardizePatternFromContent(input: {
  text?: string | null;
  images?: string[];
}): Promise<StandardizedPattern> {
  const content: UserContentPart[] = [];
  if (input.text?.trim()) content.push({ type: "text", text: input.text.trim() });
  for (const image of input.images ?? []) content.push({ type: "image", image });
  if (content.length === 0) {
    throw new Error("Se necesita un texto o una imagen para estandarizar");
  }

  const { object } = await generateObject({
    model: await getModel(),
    schema: standardizedPatternSchema,
    system: MIXED_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });
  return object;
}

/**
 * Estandariza un patrón a partir de sus imágenes (data URLs). Requiere un
 * modelo con visión (el mismo que usa la extracción de gastos).
 */
export async function standardizePatternFromImages(
  images: string[],
): Promise<StandardizedPattern> {
  return standardizePatternFromContent({ images });
}
