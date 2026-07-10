// Helpers para los filtros de los listados (búsqueda de texto + color).
// Los filtros viajan en la URL (?q=, ?tag=, ?color=) y se aplican en la query
// de servidor, igual que el filtro de etiquetas.

/** Texto de búsqueda saneado: recorta y devuelve undefined si queda vacío. */
export function normalizeSearch(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  return value ? value : undefined;
}

/** Color (#RRGGBB) → valor de parámetro de URL sin almohadilla y en minúsculas. */
export function colorToParam(hex: string): string {
  return hex.replace(/^#/, "").toLowerCase();
}

/**
 * Parámetro de URL → color #RRGGBB válido, o undefined si no lo es. Evita meter
 * basura en la query (solo acepta 6 dígitos hex).
 */
export function colorFromParam(param: string | undefined): string | undefined {
  if (!param) return undefined;
  const clean = param.replace(/^#/, "").toLowerCase();
  return /^[0-9a-f]{6}$/.test(clean) ? `#${clean}` : undefined;
}

/** Convierte un color hex a un triplete RGB. */
export function hexToRgb(hex: string): [number, number, number] | undefined {
  const clean = hex.replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(clean)) return undefined;

  const value = Number.parseInt(clean, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** Distancia euclídea en el espacio RGB entre dos colores. */
export function colorDistanceHex(aHex: string, bHex: string): number {
  const a = hexToRgb(aHex);
  const b = hexToRgb(bHex);

  if (!a || !b) return Number.POSITIVE_INFINITY;

  const [ar, ag, ab] = a;
  const [br, bg, bb] = b;
  const dr = ar - br;
  const dg = ag - bg;
  const db = ab - bb;

  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Ordena elementos por similitud de color respecto a un color base.
 * Los elementos sin color quedan al final y el color exacto va primero.
 */
export function sortByColorSimilarity<T extends { colorHex: string | null | undefined }>(
  items: T[],
  targetHex: string | undefined,
): T[] {
  if (!targetHex) return items;

  const normalizedTarget = colorFromParam(targetHex) ?? targetHex;
  if (!hexToRgb(normalizedTarget)) return items;

  return [...items].sort((left, right) => {
    const leftColor = left.colorHex;
    const rightColor = right.colorHex;

    if (!leftColor && !rightColor) return 0;
    if (!leftColor) return 1;
    if (!rightColor) return -1;

    const leftDistance = colorDistanceHex(leftColor, normalizedTarget);
    const rightDistance = colorDistanceHex(rightColor, normalizedTarget);

    return leftDistance - rightDistance;
  });
}
