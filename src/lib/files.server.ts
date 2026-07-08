import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import {
  DOCUMENT_MIME_TO_EXT,
  EXT_TO_MIME,
  IMAGE_MIME_TO_EXT,
  isUploadKind,
  isValidUploadPath,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
  type UploadKind,
  UploadError,
} from "./files";

// Almacenamiento de subidas con dos drivers tras el mismo contrato (en la BD
// se persiste siempre el pathname relativo, p. ej. "orders/ckxyz.jpg"):
// - Vercel Blob cuando hay BLOB_READ_WRITE_TOKEN (producción/previews).
// - Disco local (UPLOAD_DIR, ./uploads por defecto) sin token: desarrollo
//   offline sin depender de servicios de Vercel.

function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

// Modo de acceso del store de Blob: los stores clásicos son públicos, pero los
// nuevos pueden crearse privados y el SDK exige que cada operación coincida
// con el modo real. Se asume "public" y, si el store contesta que es del otro
// tipo, se cambia y se memoriza para el resto del proceso. Da igual el modo:
// el cliente solo ve /api/files, que aplica el control de acceso fino.
let blobAccess: "public" | "private" = "public";

function isWrongAccessError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /access on a (public|private) store/i.test(error.message)
  );
}

async function withStoreAccess<T>(
  operation: (access: "public" | "private") => Promise<T>,
): Promise<T> {
  try {
    return await operation(blobAccess);
  } catch (error) {
    if (!isWrongAccessError(error)) throw error;
    blobAccess = blobAccess === "public" ? "private" : "public";
    return operation(blobAccess);
  }
}

// Se resuelve por llamada (no al importar) para poder cambiarla en tests.
function uploadRoot(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
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
    // (sesión para documentos de patrones y fotos de compra) lo aplica
    // /api/files, la única URL que ve el cliente.
    await withStoreAccess((access) =>
      put(relPath, file, {
        access,
        addRandomSuffix: false,
        contentType: file.type,
        cacheControlMaxAge: 31536000,
      }),
    );
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
    // get() acepta el pathname directamente (con el token): una sola llamada
    // y funciona igual en stores públicos y privados.
    const result = await withStoreAccess((access) => get(relPath, { access }));
    return result?.stream ?? null;
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
      // del() acepta el pathname y es idempotente (borrar algo ausente no falla).
      await del(relPath);
    } else {
      await unlink(path.join(uploadRoot(), relPath));
    }
  } catch {
    // fichero ausente o fallo puntual del almacenamiento: no es un error fatal
  }
}
