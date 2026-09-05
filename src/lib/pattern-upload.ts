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

const DIRECT_TIMEOUT_MS = 120_000;

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

/**
 * Sube un fichero de patrón evitando el límite de ~4,5 MB del body de las
 * funciones de Vercel: los ficheros grandes van DIRECTOS a Vercel Blob (solo
 * el pedido de token atraviesa la función). Sin Blob (desarrollo local) la
 * ruta normal guarda en disco y admite hasta 25 MB.
 *
 * `onProgress` recibe el porcentaje (0-100) para feedback de subida.
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

  try {
    const pathname = `${kind}/${crypto.randomUUID()}${ext}`;
    const abortController = new AbortController();
    const timeout = window.setTimeout(
      () => abortController.abort(),
      DIRECT_TIMEOUT_MS,
    );
    try {
      const blob = await upload(pathname, file, {
        access,
        abortSignal: abortController.signal,
        contentType: mime,
        handleUploadUrl: "/api/uploads/client",
        clientPayload: JSON.stringify({ kind, mime }),
        onUploadProgress: onProgress
          ? ({ percentage }) => onProgress(Math.floor(percentage))
          : undefined,
      });
      return { path: blob.pathname };
    } finally {
      window.clearTimeout(timeout);
    }
  } catch (error) {
    // Sin fallback a /api/uploads: en Vercel ese body excede el límite de la
    // función y volvería a fallar. El mensaje muestra el motivo si lo hay.
    const message =
      error instanceof Error && error.message
        ? `No se pudo subir el fichero a Blob: ${error.message}`
        : "No se pudo subir el fichero a Blob";
    return { error: message };
  }
}
