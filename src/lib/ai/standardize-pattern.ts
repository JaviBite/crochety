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
 *
 * NOTA fase 2: la extracción de texto del fichero original (PDF con unpdf,
 * DOCX con mammoth) y la orquestación (aiStatus PENDING → PROCESSING → DONE,
 * reintentos) se implementarán junto con el CRUD de patrones. Esta función ya
 * es funcional dado el texto.
 */
export async function standardizePattern(
  rawText: string,
): Promise<StandardizedPattern> {
  const { object } = await generateObject({
    model: getModel(),
    schema: standardizedPatternSchema,
    system: SYSTEM_PROMPT,
    prompt: rawText,
  });
  return object;
}
