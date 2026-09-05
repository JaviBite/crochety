// Tipos y constantes seguras para Client y Server Components.
// Las funciones que usan node:* y almacenamiento están en files.server.ts
// (import "server-only"): NO reexportarlas desde aquí — este fichero entra en
// el bundle de cliente y server-only rompería el build.

export const UPLOAD_KINDS = ["materials", "orders", "patterns", "expenses"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export const DOCUMENT_MIME_TO_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  // Página guardada desde el navegador: escape manual para webs tras retos
  // anti-bots (el navegador del usuario ya pasó el reto).
  "text/html": ".html",
};

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024; // 25 MB

export const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".html": "text/html",
};

export function isUploadKind(value: string): value is UploadKind {
  return (UPLOAD_KINDS as readonly string[]).includes(value);
}

// Forma exacta de un pathname generado por saveUpload: tipo conocido + UUID +
// extensión conocida. Todo lo demás (traversal, prefijos arbitrarios, nombres
// originales) se rechaza antes de tocar el almacenamiento — también hace de
// barrera anti-traversal para el driver de disco.
const UPLOAD_PATH_RE = new RegExp(
  `^(${UPLOAD_KINDS.join("|")})/[0-9a-f-]{36}(${Object.keys(EXT_TO_MIME)
    .map((ext) => ext.replace(".", "\\."))
    .join("|")})$`,
);

export function isValidUploadPath(relPath: string): boolean {
  return UPLOAD_PATH_RE.test(relPath);
}

export class UploadError extends Error {}

/**
 * MIME efectivo de un File: usa el type declarado si es un MIME de imagen o
 * documento admitido y si no lo infiere de la extensión del nombre (algunos
 * navegadores mandan type vacío). OJO: el type se valida contra los mapas de
 * MIME (imagen/documento), NO contra EXT_TO_MIME, que mapea extensión→MIME —
 * los File generados en servidor a menudo no llevan extensión en el nombre
 * (p. ej. las portadas se llaman "cover" a secas).
 */
export function resolveUploadMime(file: { type: string; name: string }): string {
  const declared = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (
    declared &&
    (declared in IMAGE_MIME_TO_EXT || declared in DOCUMENT_MIME_TO_EXT)
  ) {
    return declared;
  }
  const dot = file.name.lastIndexOf(".");
  if (dot < 0) return "";
  return EXT_TO_MIME[file.name.slice(dot).toLowerCase()] ?? "";
}

// Las subidas viajan por /api/uploads (una función de Vercel): su body tiene
// un tope duro de ~4,5 MB. El margen cubre la codificación multipart.
export const UPLOAD_BODY_LIMIT_BYTES = 4.4 * 1024 * 1024;

/** Error accionable si el fichero no puede llegar a la función de subida. */
export function uploadBodyLimitError(file: File): string | null {
  if (file.size <= UPLOAD_BODY_LIMIT_BYTES) return null;
  return `«${file.name}» ocupa ${(file.size / 1024 / 1024).toFixed(1)} MB y la web admite hasta ~4,4 MB por fichero. Comprímelo, pega el texto o sube una foto.`;
}

