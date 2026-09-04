import "server-only";

import {
  standardizePattern,
  standardizePatternFromImages,
  type StandardizedPattern,
} from "@/lib/ai/standardize-pattern";
import {
  extractPatternContent,
  rasterizePdfPages,
  type PatternSource,
} from "@/lib/pattern-source";

/** Eventos de progreso del pipeline completo, pensados para UI en streaming. */
export type SourceProgress =
  | { type: "extract" }
  | { type: "text-ready"; chars: number }
  | { type: "images-ready"; count: number }
  | { type: "standardizing" }
  | { type: "segmenting" }
  | { type: "segment"; index: number; total: number }
  | { type: "rasterizing" }
  | { type: "vision-retry" };

/**
 * Estandarización completa de un origen (el pipeline que usan tanto el flujo
 * de patrones guardados como el convertidor):
 *
 * 1. Extrae el contenido (texto con indicios de patrón, o imágenes).
 * 2. Estandariza con el LLM (structured outputs).
 * 3. Si el texto "parecía" un patrón pero el LLM no encuentra nada — p. ej.
 *    una captura impresa de una web cuyo patrón está en imágenes — reintenta
 *    rasterizando las páginas del PDF y procesándolas por visión.
 */
export async function standardizePatternSource(
  source: PatternSource,
  onProgress?: (event: SourceProgress) => void,
): Promise<StandardizedPattern[]> {
  onProgress?.({ type: "extract" });
  const content = await extractPatternContent(source);
  onProgress?.(
    content.type === "images"
      ? { type: "images-ready", count: content.images.length }
      : { type: "text-ready", chars: content.text.length },
  );

  const patterns =
    content.type === "images"
      ? await standardizePatternFromImages(content.images)
      : await standardizePattern(content.text, (event) =>
          onProgress?.(event),
        );
  if (patterns.length > 0 || !source.filePath?.endsWith(".pdf")) {
    return patterns;
  }

  // El texto parecía un patrón pero el LLM no encontró nada: reintento por
  // visión con las páginas rasterizadas.
  onProgress?.({ type: "vision-retry" });
  onProgress?.({ type: "rasterizing" });
  let images: string[] = [];
  try {
    images = await rasterizePdfPages(source.filePath);
  } catch {
    images = [];
  }
  if (images.length === 0) return patterns;
  onProgress?.({ type: "images-ready", count: images.length });
  onProgress?.({ type: "standardizing" });
  return standardizePatternFromImages(images);
}
