import { randomUUID } from "node:crypto";
import path from "node:path";
import { del, list, put } from "@vercel/blob";

// Almacenamiento de subidas en Vercel Blob. En la BD se persiste el pathname
// relativo dentro del store, p. ej. "orders/ckxyz.jpg" — el mismo contrato que
// tenía el almacenamiento en disco. Requiere BLOB_READ_WRITE_TOKEN (en local:
// `vercel env pull`).

export const UPLOAD_KINDS = ["materials", "orders", "patterns"] as const;
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
// extensión conocida. Todo lo demás (traversal, prefijos arbitrarios del
// store, nombres originales) se rechaza antes de tocar Blob.
const UPLOAD_PATH_RE = new RegExp(
  `^(${UPLOAD_KINDS.join("|")})/[0-9a-f-]{36}(${Object.keys(EXT_TO_MIME)
    .map((ext) => ext.replace(".", "\\."))
    .join("|")})$`,
);

export function isValidUploadPath(relPath: string): boolean {
  return UPLOAD_PATH_RE.test(relPath);
}

/**
 * Resuelve un pathname relativo (de la BD o de la URL) a la URL del blob.
 * Devuelve null si el pathname no tiene la forma generada por saveUpload o
 * no existe en el store.
 */
export async function resolveUploadUrl(relPath: string): Promise<string | null> {
  if (!isValidUploadPath(relPath)) return null;
  const { blobs } = await list({ prefix: relPath, limit: 1 });
  const blob = blobs[0];
  return blob && blob.pathname === relPath ? blob.url : null;
}

/**
 * Sube un fichero con nombre generado (nunca el nombre original) dentro de la
 * subcarpeta del tipo. Devuelve el pathname relativo, p. ej. "orders/ckxyz.jpg"
 * — es lo que se persiste en la BD.
 */
export async function saveUpload(kind: UploadKind, file: File): Promise<string> {
  const isImage = file.type in IMAGE_MIME_TO_EXT;
  const isDocument = file.type in DOCUMENT_MIME_TO_EXT;

  if (!isImage && !isDocument) {
    throw new UploadError(`Tipo de fichero no permitido: ${file.type}`);
  }
  // Los documentos (PDF/DOCX) solo tienen sentido en la biblioteca de patrones.
  if (isDocument && kind !== "patterns") {
    throw new UploadError("Solo se admiten documentos en patrones");
  }
  const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
  if (file.size > maxBytes) {
    throw new UploadError(
      `Fichero demasiado grande (máx. ${Math.round(maxBytes / 1024 / 1024)} MB)`,
    );
  }

  const ext = isImage ? IMAGE_MIME_TO_EXT[file.type] : DOCUMENT_MIME_TO_EXT[file.type];
  const relPath = path.posix.join(kind, `${randomUUID()}${ext}`);

  // El UUID ya hace la URL del blob no adivinable; el control de acceso fino
  // (sesión para patrones) lo aplica /api/files, la única URL que ve el cliente.
  await put(relPath, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type,
    cacheControlMaxAge: 31536000,
  });

  return relPath;
}

/**
 * Borra un fichero subido a partir de su pathname relativo. Ignora rutas
 * nulas, inválidas o ya inexistentes: borrar es best-effort (evita ficheros
 * huérfanos al eliminar/reemplazar) y nunca debe tumbar la operación principal.
 */
export async function deleteUpload(
  relPath: string | null | undefined,
): Promise<void> {
  if (!relPath) return;
  try {
    const url = await resolveUploadUrl(relPath);
    if (url) await del(url);
  } catch {
    // fichero ausente o fallo de red en el borrado: no es un error fatal
  }
}

export class UploadError extends Error {}
