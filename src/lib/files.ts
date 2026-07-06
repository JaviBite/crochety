import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, list, put } from "@vercel/blob";

// Almacenamiento de subidas con dos drivers tras el mismo contrato (en la BD
// se persiste siempre el pathname relativo, p. ej. "orders/ckxyz.jpg"):
// - Vercel Blob cuando hay BLOB_READ_WRITE_TOKEN (producción/previews).
// - Disco local (UPLOAD_DIR, ./uploads por defecto) sin token: desarrollo
//   offline sin depender de servicios de Vercel.

function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

// Se resuelve por llamada (no al importar) para poder cambiarla en tests.
function uploadRoot(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
}

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

/**
 * Resuelve un pathname relativo a la URL del blob (solo driver Blob).
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

  if (hasBlobToken()) {
    // El UUID ya hace la URL del blob no adivinable; el control de acceso fino
    // (sesión para patrones) lo aplica /api/files, la única URL que ve el cliente.
    await put(relPath, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type,
      cacheControlMaxAge: 31536000,
    });
  } else {
    const absPath = path.join(uploadRoot(), relPath);
    await mkdir(path.dirname(absPath), { recursive: true });
    await writeFile(absPath, Buffer.from(await file.arrayBuffer()));
  }

  return relPath;
}

/**
 * Devuelve el contenido de un fichero subido (stream con Blob, bytes con
 * disco) o null si el pathname es inválido o no existe.
 */
export async function readUpload(
  relPath: string,
): Promise<ReadableStream<Uint8Array> | Uint8Array<ArrayBuffer> | null> {
  if (!isValidUploadPath(relPath)) return null;

  if (hasBlobToken()) {
    const url = await resolveUploadUrl(relPath);
    if (!url) return null;
    const res = await fetch(url);
    return res.ok && res.body ? res.body : null;
  }

  try {
    return new Uint8Array(await readFile(path.join(uploadRoot(), relPath)));
  } catch {
    return null;
  }
}

/**
 * Borra un fichero subido a partir de su pathname relativo. Ignora rutas
 * nulas, inválidas o ya inexistentes: borrar es best-effort (evita ficheros
 * huérfanos al eliminar/reemplazar) y nunca debe tumbar la operación principal.
 */
export async function deleteUpload(
  relPath: string | null | undefined,
): Promise<void> {
  if (!relPath || !isValidUploadPath(relPath)) return;
  try {
    if (hasBlobToken()) {
      const url = await resolveUploadUrl(relPath);
      if (url) await del(url);
    } else {
      await unlink(path.join(uploadRoot(), relPath));
    }
  } catch {
    // fichero ausente o fallo puntual del almacenamiento: no es un error fatal
  }
}

export class UploadError extends Error {}
