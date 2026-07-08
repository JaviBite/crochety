// Tipos y constantes seguras para Client y Server Components.
// Las funciones que usan node:* y almacenamiento están en files.server.ts.

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

// Re-export server-only functions for use in server actions and API routes.
// This prevents them from being bundled into Client Components.
export {
  deleteUpload,
  readUpload,
  saveUpload,
} from "./files.server";

