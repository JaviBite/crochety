import { generateObject } from "ai";
import { z } from "zod";
import {
  MAX_PATTERNS_PER_CALL,
  normalizeStandardizedPatterns,
  standardizedPatternsSchema,
  type StandardizedPattern,
} from "./standardize-pattern.shared";
import { getModel } from "./provider";

// Re-export shared types and functions for backward compatibility.
export {
  emptyStandardizedPattern,
  normalizeStandardizedPattern,
  normalizeStandardizedPatterns,
  parseStandardizedContent,
  parseStandardizedPatternsContent,
  standardizedPatternSchema,
  standardizedPatternsSchema,
  MAX_PATTERNS_PER_CALL,
  type StandardizedPattern,
  type StandardizedPatterns,
} from "./standardize-pattern.shared";

const SYSTEM_PROMPT = `Eres un experto en patrones de crochet y amigurumi.
Recibirás el contenido de uno o VARIOS patrones (texto extraído de un PDF, DOCX
o página web, imágenes, o una mezcla), en cualquier idioma y con cualquier
formato o notación.

Tu tarea es estandarizar TODOS los patrones que encuentres al esquema JSON
indicado, en español y con la notación española habitual (pb = punto bajo,
aum = aumento, dism = disminución, pa = punto alto, am = anillo mágico).
Devuelve cada patrón completo, en el orden en que aparecen, sin mezclarlos
entre sí y sin inventar contenido. Conserva fielmente los números de puntos y
repeticiones: no inventes rondas ni omitas ninguna. Si un dato no aparece en
el original, usa null. Si la entrada no contiene ningún patrón de crochet,
devuelve una lista vacía.

REGLA GENERAL — incluye TODO el texto relevante del patrón, sin borrar, ni
resumir, ni perder nada que aporte información. Cada trozo del original tiene
un hueco en el esquema:
- Rondas y filas de puntos → las filas de su sección, con su label, conteo y
  nota de repeticiones (p. ej. "x6", "por 4 rondas") si la lleva.
- Instrucciones que NO son rondas (añadir ojos de seguridad, empezar a
  rellenar, cortar hilo, cambiar de color, coser piezas, dejar hilo largo,
  marcar puntos…) → filas kind "step" en su punto exacto, sin conteo.
- "Tips", notas, avisos y observaciones que aparecen entre rondas o al final
  de una sección → filas kind "step" en su punto exacto (p. ej. "Tip: usa un
  marcador de puntos") o el campo notes de la sección si son generales.
- Materiales, aguja, medidas, dificultad, nivel → los campos de metadatos.
- Montaje, acabado, lavado, costura, trucos generales → assemblyNotes. Las
  secciones "Finishing", "Assembly", "Acabados" o similares se copian
  COMPLETAS en assemblyNotes, paso a paso y con sus detalles (cose, inserta,
  hilo largo, pelo, ojos…) — nunca un resumen de una línea.
Solo puedes omitir el ruido ajeno al patrón: menús, cabeceras de "compartir",
publicidad, cookies, paginación y elementos de maquetación de la web o del
PDF escaneado.`;

/**
 * Agente de estandarización: texto crudo del origen → patrones estandarizados
 * (puede haber más de uno en un mismo PDF/web).
 *
 * Textos largos (recopilatorios) van en DOS fases: primero el LLM divide el
 * documento en patrones completos y luego cada segmento se estandariza por
 * separado — con una sola llamada los modelos tienden a colapsar 9 patrones
 * en uno (comprobado con el recopilatorio de Halloween).
 */
const SEGMENTATION_THRESHOLD = 10_000;

const patternSegmentsSchema = z.object({
  segments: z
    .array(
      z.object({
        title: z.string().describe("Título del patrón tal como aparece"),
        text: z
          .string()
          .describe(
            "Texto COMPLETO y literal del patrón (materiales, abreviaturas y "
              + "TODAS sus rondas e instrucciones), sin resumir ni recortar",
          ),
      }),
    )
    .min(1)
    .max(MAX_PATTERNS_PER_CALL)
    .describe("Todos los patrones detectados en el documento, en orden"),
});

const SEGMENTATION_PROMPT = `Recibirás un documento que puede contener uno o VARIOS patrones de crochet.
Divide el contenido en segmentos, uno por patrón completo, en el orden original.
Cada segmento debe llevar el texto literal y completo de UN patrón: sus
materiales, abreviaturas y TODAS sus rondas e instrucciones, sin resumir,
recortar ni mezclar contenido de otros patrones. Las instrucciones sueltas que
no pertenezcan a ninguna ronda (montaje, acabados) van con su patrón. Si el
documento solo contiene un patrón, devuélvelo como único segmento.`;

export type StandardizeProgress =
  | { type: "standardizing" }
  | { type: "segmenting" }
  | { type: "segment"; index: number; total: number };

async function segmentPatternText(
  rawText: string,
): Promise<{ title: string; text: string }[]> {
  const { object } = await generateObject({
    model: await getModel(),
    schema: patternSegmentsSchema,
    system: SEGMENTATION_PROMPT,
    prompt: rawText,
  });
  return object.segments;
}

export async function standardizePattern(
  rawText: string,
  onProgress?: (event: StandardizeProgress) => void,
): Promise<StandardizedPattern[]> {
  let segments: { title: string; text: string }[] | null = null;
  if (rawText.length > SEGMENTATION_THRESHOLD) {
    try {
      onProgress?.({ type: "segmenting" });
      segments = await segmentPatternText(rawText);
    } catch {
      // Sin segmentación fiable: un único intento con todo el texto.
      segments = null;
    }
  }
  if (!segments || segments.length <= 1) {
    onProgress?.({ type: "standardizing" });
    return standardizePatternFromContent({ text: rawText });
  }

  // Estandariza cada patrón por separado, con concurrencia limitada para no
  // reventar el rate limit de los modelos gratuitos.
  const results: StandardizedPattern[] = [];
  const queue = [...segments];
  let started = 0;
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const segment = queue.shift()!;
      started += 1;
      onProgress?.({ type: "segment", index: started, total: segments!.length });
      try {
        const patterns = await standardizePatternFromContent({
          text: segment.text,
        });
        results.push(...patterns);
      } catch {
        // Un segmento que falla no tira el lote entero.
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(3, queue.length) }, () => worker()),
  );
  return normalizeStandardizedPatterns(results);
}

const MIXED_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

El contenido puede llegar como texto (pegado a mano o extraído de un PDF/DOCX/
web), como una o varias IMÁGENES (fotos o capturas de páginas), o ambos a la
vez. Lee también el texto y las tablas de puntos que aparezcan en las
imágenes. Si hay varias imágenes, trátalas como páginas consecutivas del mismo
origen, en el orden dado.`;

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
}): Promise<StandardizedPattern[]> {
  const content: UserContentPart[] = [];
  if (input.text?.trim()) content.push({ type: "text", text: input.text.trim() });
  for (const image of input.images ?? []) content.push({ type: "image", image });
  if (content.length === 0) {
    throw new Error("Se necesita un texto o una imagen para estandarizar");
  }

  const { object } = await generateObject({
    model: await getModel(),
    schema: standardizedPatternsSchema,
    system: MIXED_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });
  return normalizeStandardizedPatterns(object.patterns);
}

/**
 * Estandariza a partir de las imágenes del origen (data URLs). Requiere un
 * modelo con visión (el mismo que usa la extracción de gastos).
 */
export async function standardizePatternFromImages(
  images: string[],
): Promise<StandardizedPattern[]> {
  return standardizePatternFromContent({ images });
}
