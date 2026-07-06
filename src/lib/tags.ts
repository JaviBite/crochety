// Etiquetas libres para materiales y patrones. Se normalizan a minúsculas/trim
// para que "Lana", "lana " y "LANA" sean la misma etiqueta (Tag.name es único).

export const MAX_TAG_LENGTH = 30;
export const MAX_TAGS = 20;

/**
 * Normaliza el valor crudo del input de tags (una cadena separada por comas) a
 * una lista de nombres normalizados, sin duplicados ni vacíos y con tope de
 * cantidad. "Lana, Algodón , verde,verde" -> ["lana", "algodón", "verde"].
 */
export function parseTagNames(raw: FormDataEntryValue | null | undefined): string[] {
  if (typeof raw !== "string" || !raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const name = part.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

type ConnectOrCreate = {
  connectOrCreate: { where: { name: string }; create: { name: string } }[];
};

function connectOrCreate(names: string[]): ConnectOrCreate {
  return {
    connectOrCreate: names.map((name) => ({
      where: { name },
      create: { name },
    })),
  };
}

/** Nested write para crear una entidad con sus tags (undefined si no hay). */
export function tagsCreateInput(names: string[]): ConnectOrCreate | undefined {
  return names.length ? connectOrCreate(names) : undefined;
}

/**
 * Nested write para reemplazar por completo los tags en un update: `set: []`
 * desconecta los actuales y connectOrCreate reconecta/crea los nuevos.
 */
export function tagsUpdateInput(
  names: string[],
): { set: never[] } & Partial<ConnectOrCreate> {
  return names.length ? { set: [], ...connectOrCreate(names) } : { set: [] };
}
