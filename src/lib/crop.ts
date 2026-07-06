// Geometría del recorte de imágenes en cliente (para acotar el producto de una
// captura antes de mandarla a la IA de gastos). Puro y testeable; el dibujado a
// Canvas vive en el componente.

export type Rect = { x: number; y: number; width: number; height: number };

/** Rectángulo normalizado (w/h positivos) a partir de dos puntos del arrastre. */
export function rectFromPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

/**
 * Convierte una selección hecha sobre la imagen mostrada (en píxeles de
 * pantalla) al recorte equivalente en píxeles reales de la imagen, saneado y
 * recortado a los límites. Devuelve null si la selección es demasiado pequeña.
 */
export function scaleCropToNatural(
  selection: Rect,
  display: { width: number; height: number },
  natural: { width: number; height: number },
  minSize = 4,
): Rect | null {
  if (display.width <= 0 || display.height <= 0) return null;
  if (selection.width < minSize || selection.height < minSize) return null;

  const sx = natural.width / display.width;
  const sy = natural.height / display.height;

  const x = Math.max(0, Math.min(natural.width, selection.x * sx));
  const y = Math.max(0, Math.min(natural.height, selection.y * sy));
  const width = Math.max(1, Math.min(natural.width - x, selection.width * sx));
  const height = Math.max(1, Math.min(natural.height - y, selection.height * sy));

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}
