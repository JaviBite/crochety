// Avatar de iniciales para el balance estilo Splitwise: dos primeras
// iniciales del nombre y un tono derivado de un hash del nombre (estable para
// que cada persona conserve su color entre visitas). La luz/saturación las
// aplica la clase .initials-avatar de globals.css según el tema.

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/** Tono 0-360 derivado del nombre (hash estable, independiente del locale). */
export function avatarHue(name: string): number {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash % 360;
}
