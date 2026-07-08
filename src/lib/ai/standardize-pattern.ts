import { generateObject } from "ai";
import {
  emptyStandardizedPattern,
  normalizeStandardizedPattern,
  parseStandardizedContent,
  standardizedPatternSchema,
  type StandardizedPattern,
} from "./standardize-pattern.shared";
import { getModel } from "./provider";

// Re-export shared types and functions for backward compatibility.
export {
  emptyStandardizedPattern,
  normalizeStandardizedPattern,
  parseStandardizedContent,
  standardizedPatternSchema,
  type StandardizedPattern,
} from "./standardize-pattern.shared";

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
  return normalizeStandardizedPattern(object);
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
  return normalizeStandardizedPattern(object);
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
