import "server-only";

import {
  standardizePattern,
  standardizePatternFromContent,
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
/**
 * Estandarización completa de un origen (el pipeline que usan tanto el flujo
 * de patrones guardados como el convertidor):
 *
 * 1. Extrae el contenido (texto con indicios de patrón, o imágenes).
 * 2. Estandariza con el LLM (structured outputs).
 * 3. Si el texto "parecía" un patrón pero el LLM no encuentra nada — p. ej.
 *    una captura impresa de una web cuyo patrón está en imágenes — reintenta
 *    rasterizando las páginas del PDF y procesándolas por visión.
 *
 * `opts.extraText` añade texto pegado a mano (convertidor): se antepone al
 * texto extraído o se combina con las imágenes (el prompt mixto lee ambos).
 */
export async function standardizePatternSource(
  source: PatternSource,
  onProgress?: (event: SourceProgress) => void,
  { extraText }: { extraText?: string } = {},
): Promise<StandardizedPattern[]> {
  onProgress?.({ type: "extract" });

  // Origen vacío (convertidor con SOLO texto pegado a mano): no hay nada que
  // extraer, va directo al LLM como contenido mixto de una sola pieza.
  if (
    !source.filePath &&
    !source.externalUrl &&
    !(source.imagePaths?.length ?? 0)
  ) {
    const text = extraText ?? "";
    onProgress?.({ type: "text-ready", chars: text.length });
    if (!text) return [];
    return standardizePattern(text, (event) => onProgress?.(event));
  }

  const content = await extractPatternContent(source);
  onProgress?.(
    content.type === "images"
      ? { type: "images-ready", count: content.images.length }
      : { type: "text-ready", chars: content.text.length },
  );

  let patterns: StandardizedPattern[];
  if (content.type === "images") {
    patterns = extraText
      ? await standardizePatternFromContent({
          text: extraText,
          images: content.images,
        })
      : await standardizePatternFromImages(content.images);
  } else {
    const merged = extraText
      ? `${extraText}\n\n${content.text}`
      : content.text;
    patterns = await standardizePattern(merged, (event) => onProgress?.(event));
  }
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
  return standardizePatternFromContent({ text: extraText, images });
}
