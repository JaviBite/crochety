// Utilidades de assets servidos por el proxy /api/files. Util pura (sin
// "use client" ni server-only): la llaman server components y client comps.
export function assetUrl(path: string): string {
  return `/api/files/${path}`;
}
