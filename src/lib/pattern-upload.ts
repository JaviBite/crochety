"use client";

import { upload } from "@vercel/blob/client";
import {
  DOCUMENT_MIME_TO_EXT,
  IMAGE_MIME_TO_EXT,
  resolveUploadMime,
  UPLOAD_BODY_LIMIT_BYTES,
  type UploadKind,
} from "@/lib/files";

type UploadResponse = { path?: string; error?: string };

/** Uploads large pattern files directly to Blob, bypassing Vercel's body cap. */
export async function uploadPatternFile(
  file: File,
  kind: UploadKind = "patterns",
): Promise<{ path: string } | { error: string }> {
  if (file.size > UPLOAD_BODY_LIMIT_BYTES) {
    const mime = resolveUploadMime(file);
    const ext = IMAGE_MIME_TO_EXT[mime] ?? DOCUMENT_MIME_TO_EXT[mime];
    if (ext) {
      const capability = await fetch("/api/uploads/client", {
        method: "GET",
        cache: "no-store",
      }).catch(() => null);
      if (!capability?.ok) {
        return { error: "La subida directa de ficheros grandes no está disponible" };
      }
      try {
        const pathname = `${kind}/${crypto.randomUUID()}${ext}`;
        const abortController = new AbortController();
        const timeout = window.setTimeout(() => abortController.abort(), 60_000);
        try {
          const blob = await upload(pathname, file, {
            access: "public",
            abortSignal: abortController.signal,
            contentType: mime,
            handleUploadUrl: "/api/uploads/client",
            clientPayload: JSON.stringify({ kind, mime }),
          });
          return { path: blob.pathname };
        } finally {
          window.clearTimeout(timeout);
        }
      } catch {
        return { error: "No se pudo subir el fichero grande a Blob" };
      }
    }
  }

  const body = new FormData();
  body.set("file", file);
  body.set("kind", kind);
  try {
    const response = await fetch("/api/uploads", { method: "POST", body });
    const data = (await response.json().catch(() => null)) as UploadResponse | null;
    if (response.ok && data?.path) return { path: data.path };
    return { error: data?.error ?? "No se pudo subir el fichero" };
  } catch {
    return { error: "No se pudo subir el fichero" };
  }
}
