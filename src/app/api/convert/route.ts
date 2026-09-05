import { auth } from "@/lib/auth";
import { isValidUploadPath } from "@/lib/files";
import { deleteUpload } from "@/lib/files.server";
import {
  collectCoverCandidates,
  PatternSourceError,
  type PatternSource,
} from "@/lib/pattern-source";
import { standardizePatternSource } from "@/lib/ai/standardize-source";
import { z } from "zod";

// POST /api/convert — convierte un origen en patrones estandarizados
// emitiendo el progreso EN VIVO por streaming (NDJSON: una línea JSON por
// evento). Mismo contrato que la antigua server action convertPattern, con
// feedback de pasos: extract → text-ready → segmenting → segment i/n → done.

export const runtime = "nodejs";

const MAX_TEXT_CHARS = 60_000;

function uploadedPath(value: FormDataEntryValue | null): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s && isValidUploadPath(s) && s.startsWith("patterns/") ? s : null;
}

function uploadedImagePaths(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p) => uploadedPath(typeof p === "string" ? p : null))
      .filter((p): p is string => p !== null)
      .slice(0, 12);
  } catch {
    return [];
  }
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return new Response("No autorizado", { status: 401 });
  }

  const formData = await request.formData();
  const filePath = uploadedPath(formData.get("filePath"));
  const imagePaths = uploadedImagePaths(formData.get("imagePaths"));
  const rawUrl = String(formData.get("externalUrl") ?? "").trim();
  const text = String(formData.get("text") ?? "")
    .trim()
    .slice(0, MAX_TEXT_CHARS);

  const urlSchema = z.union([z.null(), z.url("El enlace no es una URL válida")]);
  const parsedUrl = urlSchema.safeParse(rawUrl || null);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let succeeded = false;

      try {
        if (!parsedUrl.success) {
          send({ type: "error", message: "El enlace no es una URL válida" });
          return;
        }
        if (!filePath && !parsedUrl.data && !text && imagePaths.length === 0) {
          send({
            type: "error",
            message: "Añade un fichero, un enlace, texto o imágenes",
          });
          return;
        }

        const source: PatternSource = {
          filePath,
          externalUrl: parsedUrl.data,
          imagePaths,
        };

        const patterns = await standardizePatternSource(source, send);

        if (patterns.length === 0) {
          send({
            type: "error",
            message: "No se detectó ningún patrón en el contenido",
          });
          return;
        }

        // Portadas: candidatas del origen (PDF/web), la primera es la propuesta.
        let coverCandidates: string[] = [];
        try {
          coverCandidates = await collectCoverCandidates(source);
        } catch {
          coverCandidates = [];
        }
        // El origen viaja en el resultado: si el usuario guarda el patrón,
        // se persiste con su fichero/imágenes/enlace originales. Los ficheros
        // NO se borran al terminar la conversión (solo si falla o al descartar
        // los resultados con discardConvertedSource).
        succeeded = true;
        send({
          type: "done",
          patterns,
          source: {
            filePath,
            externalUrl: parsedUrl.data,
            imagePaths,
          },
          autoCover: coverCandidates[0] ?? null,
          coverCandidates,
        });
      } catch (error) {
        send({
          type: "error",
          message:
            error instanceof PatternSourceError
              ? error.message
              : "La conversión falló, vuelve a intentarlo",
        });
      } finally {
        // Los ficheros de una conversión fallida son inservibles: fuera.
        if (!succeeded) {
          await Promise.allSettled(
            [filePath, ...imagePaths]
              .filter((p): p is string => Boolean(p))
              .map((p) => deleteUpload(p)),
          );
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
