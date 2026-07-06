import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Raíz de subidas: en dev ./uploads, en Docker /app/uploads (volumen).
export const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

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

/**
 * Guarda un fichero subido con nombre generado (nunca el nombre original)
 * dentro de la subcarpeta del tipo. Devuelve la ruta relativa a UPLOAD_ROOT,
 * p. ej. "orders/ckxyz.jpg" — es lo que se persiste en la BD.
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
  const absPath = path.join(UPLOAD_ROOT, relPath);

  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, Buffer.from(await file.arrayBuffer()));

  return relPath;
}

/**
 * Resuelve una ruta relativa (de la BD o de la URL) a una absoluta dentro de
 * UPLOAD_ROOT. Devuelve null si el path escapa de la raíz (../, absolutos…).
 */
export function resolveUploadPath(relPath: string): string | null {
  const abs = path.resolve(UPLOAD_ROOT, relPath);
  if (abs !== UPLOAD_ROOT && !abs.startsWith(UPLOAD_ROOT + path.sep)) {
    return null;
  }
  return abs;
}

export class UploadError extends Error {}
