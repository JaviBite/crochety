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

type UploadResult = { path: string } | { error: string };

// Límite por intento: en conexiones lentas un PDF de ~5 MB puede tardar ~1 min
// en subir; dos intentos completos caben en el peor caso sin bloquear la UI.
const ATTEMPT_TIMEOUT_MS = 90_000;

async function uploadViaRoute(
  file: File,
  kind: UploadKind,
): Promise<UploadResult> {
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

async function directUpload(
  file: File,
  kind: UploadKind,
  mime: string,
  access: "public" | "private",
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  // Pathname nuevo por intento: evita carreras si un intento anterior llegó a
  // cerrarse en el store cuando este ya ha empezado.
  const pathname = `${kind}/${crypto.randomUUID()}${
    IMAGE_MIME_TO_EXT[mime] ?? DOCUMENT_MIME_TO_EXT[mime]
  }`;
  const abortController = new AbortController();
  const timeout = window.setTimeout(
    () => abortController.abort(),
    ATTEMPT_TIMEOUT_MS,
  );
  try {
    const blob = await upload(pathname, file, {
      access,
      abortSignal: abortController.signal,
      contentType: mime,
      handleUploadUrl: "/api/uploads/client",
      clientPayload: JSON.stringify({ kind, mime }),
      // Con progreso el SDK sube por streaming (duplex); sin él usa la ruta
      // fetch clásica con el fichero entero — compatible con proxies/AV que
      // rompen la subida en streaming.
      ...(onProgress
        ? {
            onUploadProgress: ({ percentage }: { percentage: number }) =>
              onProgress(Math.min(99, Math.floor(percentage))),
          }
        : {}),
    });
    return { path: blob.pathname };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : "No se pudo subir el fichero a Blob",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Sube un fichero de patrón evitando el límite de ~4,5 MB del body de las
 * funciones de Vercel: los ficheros grandes van DIRECTOS a Vercel Blob (solo
 * el pedido de token atraviesa la función). Sin Blob (desarrollo local) la
 * ruta normal guarda en disco y admite hasta 25 MB.
 *
 * `onProgress` recibe el porcentaje (0-99) para feedback de subida.
 */
export async function uploadPatternFile(
  file: File,
  kind: UploadKind = "patterns",
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const viaRoute = () => uploadViaRoute(file, kind);

  if (file.size <= UPLOAD_BODY_LIMIT_BYTES) return viaRoute();

  const mime = resolveUploadMime(file);
  const ext = IMAGE_MIME_TO_EXT[mime] ?? DOCUMENT_MIME_TO_EXT[mime];
  if (!ext) {
    // Sin extensión conocida: la ruta normal devuelve el error concreto.
    return viaRoute();
  }

  // Capacidad + modo del store (público/privado). 503 = sin Blob (local).
  let access: "public" | "private";
  try {
    const capability = await fetch("/api/uploads/client", {
      method: "GET",
      cache: "no-store",
    });
    if (!capability.ok) return viaRoute();
    const data = (await capability.json().catch(() => null)) as {
      access?: string;
    } | null;
    if (data?.access !== "public" && data?.access !== "private") {
      return viaRoute();
    }
    access = data.access;
  } catch {
    return viaRoute();
  }

  // 1er intento: con progreso (subida en streaming).
  const first = await directUpload(file, kind, mime, access, onProgress);
  if ("path" in first) return first;
  // 2º intento: ruta clásica sin streaming (el SDK omite el transform de
  // trozos cuando no hay onUploadProgress). Sin porcentaje, solo spinner.
  return directUpload(file, kind, mime, access);
}
