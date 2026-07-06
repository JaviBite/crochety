// Utilidades de color en cliente para sugerir el color dominante de la foto de
// un material (sin dependencias: se calcula sobre el ImageData de un Canvas).

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function rgbToHex(r: number, g: number, b: number): string {
  const hex = (n: number) => clampByte(n).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function hexToRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/**
 * Color dominante de un buffer RGBA (Canvas `ImageData.data`). Cuantiza cada
 * canal a `bits` bits para agrupar tonos parecidos, cuenta el cubo más poblado
 * y devuelve el promedio real de sus píxeles. `step` submuestrea para acelerar.
 * Ignora píxeles muy transparentes. Devuelve null si no hay píxeles válidos.
 */
export function dominantColorHex(
  data: Uint8ClampedArray | number[],
  { step = 1, bits = 4 }: { step?: number; bits?: number } = {},
): string | null {
  const shift = 8 - bits;
  const buckets = new Map<
    number,
    { count: number; r: number; g: number; b: number }
  >();

  const stride = 4 * Math.max(1, step);
  for (let i = 0; i + 3 < data.length; i += stride) {
    if (data[i + 3] < 125) continue; // ignora casi-transparentes
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key =
      ((r >> shift) << (2 * bits)) | ((g >> shift) << bits) | (b >> shift);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  let best: { count: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket;
  }
  if (!best) return null;
  return rgbToHex(best.r / best.count, best.g / best.count, best.b / best.count);
}
