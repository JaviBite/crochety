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
