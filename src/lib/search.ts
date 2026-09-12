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

/** Convierte un color hex a HSL (h 0-360, s y l 0-1), o undefined si no es válido. */
export function hexToHsl(hex: string): [number, number, number] | undefined {
  const [r255, g255, b255] = (hexToRgb(hex) ?? []).map((channel) => channel / 255);
  if (r255 === undefined || g255 === undefined || b255 === undefined) {
    return undefined;
  }

  const max = Math.max(r255, g255, b255);
  const min = Math.min(r255, g255, b255);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue: number;
  if (max === r255) {
    hue = ((g255 - b255) / delta) % 6;
  } else if (max === g255) {
    hue = (b255 - r255) / delta + 2;
  } else {
    hue = (r255 - g255) / delta + 4;
  }

  return [((hue * 60) + 360) % 360, saturation, lightness];
}

/**
 * Ordena muestras por familia de color (hue) para el selector de color:
 * primero los cromáticos en arcoíris y al final los neutros (grises/negros/
 * blancos) por luminosidad. El redondeo a familias de 30° evita partir los
 * rojos en los extremos (350° y 10° caen en la misma familia).
 */
export function sortByColorHue(hexes: string[]): string[] {
  const parsed = hexes
    .map((hex) => ({ hex, hsl: hexToHsl(hex) }))
    .filter((entry): entry is { hex: string; hsl: [number, number, number] } =>
      entry.hsl !== undefined,
    );

  const chromatic = parsed.filter((entry) => entry.hsl[1] >= 0.08);
  const neutrals = parsed
    .filter((entry) => entry.hsl[1] < 0.08)
    .sort((a, b) => a.hsl[2] - b.hsl[2]);

  chromatic.sort((a, b) => {
    const familyA = Math.round(a.hsl[0] / 30) % 12;
    const familyB = Math.round(b.hsl[0] / 30) % 12;
    if (familyA !== familyB) return familyA - familyB;
    return a.hsl[2] - b.hsl[2];
  });

  return [...chromatic, ...neutrals].map((entry) => entry.hex);
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
