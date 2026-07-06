// Modo de visualización de un listado (cuadrícula con imágenes o lista
// compacta). Se persiste por sección en una cookie —patrón del acento— para
// que el servidor renderice la variante correcta sin flash.

export const VIEW_MODES = ["grid", "list"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export function parseView(
  value: string | undefined,
  fallback: ViewMode = "grid",
): ViewMode {
  return (VIEW_MODES as readonly string[]).includes(value ?? "")
    ? (value as ViewMode)
    : fallback;
}

export function viewCookieName(section: string): string {
  return `view-${section}`;
}
