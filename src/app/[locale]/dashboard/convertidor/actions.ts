"use server";

import { revalidatePath } from "next/cache";
import {
  MAX_PATTERNS_PER_CALL,
  normalizeStandardizedPattern,
  standardizedPatternSchema,
  standardizedPatternsSchema,
  standardizePattern,
  standardizePatternFromImages,
  type StandardizedPattern,
} from "@/lib/ai/standardize-pattern";
import { auth } from "@/lib/auth";
import {
  EXT_TO_MIME,
  IMAGE_MIME_TO_EXT,
  isValidUploadPath,
} from "@/lib/files";
import { deleteUpload, readUpload } from "@/lib/files.server";
import {
  collectCoverCandidates,
  extractPatternContent,
  PatternSourceError,
  saveChosenCover,
  type PatternSource,
} from "@/lib/pattern-source";
import { toEpub, toEpubAnthology } from "@/lib/pattern-export.server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Convertidor efímero: el origen se estandariza con IA (structured outputs)
// y se devuelve al cliente SIN tocar la BD. Los ficheros subidos al elegirlos
// (trampa #10) se borran al terminar: solo viven durante la conversión.

export type ConvertResult = {
  patterns: StandardizedPattern[];
  /** Portada propuesta automáticamente (mejor candidata del origen). */
  autoCover: string | null;
  /** Candidatas de portada del origen (data-URL del PDF o URL remota). */
  coverCandidates: string[];
};

export type ConvertState = ConvertResult | { error: string } | null;

export type ExportState = { base64: string } | { error: string };

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

/** Limpia los ficheros temporales de la conversión (best-effort). */
async function cleanupTempUploads(paths: (string | null)[]) {
  await Promise.allSettled(
    paths.filter((p): p is string => Boolean(p)).map((p) => deleteUpload(p)),
  );
}

export async function convertPattern(
  _prev: ConvertState,
  formData: FormData,
): Promise<ConvertState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const filePath = uploadedPath(formData.get("filePath"));
  const imagePaths = uploadedImagePaths(formData.get("imagePaths"));
  const rawUrl = String(formData.get("externalUrl") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim().slice(0, MAX_TEXT_CHARS);

  const urlSchema = z.union([z.null(), z.url("El enlace no es una URL válida")]);
  const parsedUrl = urlSchema.safeParse(rawUrl || null);
  if (!parsedUrl.success) return { error: "El enlace no es una URL válida" };

  if (!filePath && !parsedUrl.data && !text && imagePaths.length === 0) {
    return { error: "Añade un fichero, un enlace, texto o imágenes" };
  }

  const source: PatternSource = {
    filePath,
    externalUrl: parsedUrl.data,
    imagePaths,
  };

  try {
    // El parsing a patrón estandarizado SIEMPRE lo hace el LLM; solo se
    // decide qué contenido enviarle (texto o imágenes).
    const content = await extractPatternContent(source);
    const patterns =
      content.type === "images"
        ? await standardizePatternFromImages(content.images)
        : await standardizePattern(content.text);

    if (patterns.length === 0) {
      return { error: "No se detectó ningún patrón en el contenido" };
    }

    // Portadas: candidatas del origen (PDF/web), la primera es la propuesta.
    let coverCandidates: string[] = [];
    try {
      coverCandidates = await collectCoverCandidates(source);
    } catch {
      coverCandidates = [];
    }

    return {
      patterns,
      autoCover: coverCandidates[0] ?? null,
      coverCandidates,
    };
  } catch (error) {
    return {
      error:
        error instanceof PatternSourceError
          ? error.message
          : "La conversión falló, vuelve a intentarlo",
    };
  } finally {
    await cleanupTempUploads([filePath, ...imagePaths]);
  }
}

/**
 * Guarda un patrón convertido en la biblioteca: valida el documento contra
 * el contrato y crea el Pattern (aiStatus DONE). Si hay portada (data-URL,
 * URL remota o pathname ya subido al storage) se persiste como coverImagePath.
 */
export async function saveConvertedPattern(
  pattern: StandardizedPattern,
  coverSrc?: string | null,
): Promise<{ id: string } | { error: string }> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const parsed = standardizedPatternSchema.safeParse(pattern);
  if (!parsed.success) {
    return { error: "El patrón no cumple el formato estandarizado" };
  }
  const doc = normalizeStandardizedPattern(parsed.data);
  if (!doc.title) return { error: "El patrón necesita un título" };

  let coverImagePath: string | null = null;
  if (coverSrc) {
    if (isValidUploadPath(coverSrc) && coverSrc.startsWith("patterns/")) {
      // Portada ya subida por el usuario: se queda donde está.
      coverImagePath = coverSrc;
    } else {
      try {
        coverImagePath = await saveChosenCover(coverSrc);
      } catch {
        coverImagePath = null;
      }
    }
  }

  const created = await prisma.pattern.create({
    data: {
      title: doc.title,
      standardizedContent: JSON.stringify(doc),
      aiStatus: "DONE",
      ...(coverImagePath ? { coverImagePath } : {}),
    },
  });
  revalidatePath("/", "layout");
  return { id: created.id };
}

/** Borra una portada subida al convertidor que no llegó a guardarse. */
export async function deleteConvertCover(path: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  if (isValidUploadPath(path) && path.startsWith("patterns/")) {
    await deleteUpload(path).catch(() => {});
  }
}

/** data-URL, URL remota o pathname del storage → File con extensión (portada). */
async function coverFileFromSrc(src: string): Promise<File | undefined> {
  try {
    if (src.startsWith("data:")) {
      const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(src);
      if (!match) return undefined;
      const ext = IMAGE_MIME_TO_EXT[match[1]] ?? ".jpg";
      return new File([Buffer.from(match[2], "base64")], `cover${ext}`, {
        type: match[1],
      });
    }
    // Portada subida por el usuario: ya vive en el storage.
    if (isValidUploadPath(src) && src.startsWith("patterns/")) {
      const bytes = await readUpload(src);
      if (!bytes) return undefined;
      const content =
        bytes instanceof Uint8Array
          ? bytes
          : new Uint8Array(await new Response(bytes).arrayBuffer());
      const ext = src.slice(src.lastIndexOf(".")) || ".jpg";
      return new File([content as BlobPart], `cover${ext}`, {
        type: EXT_TO_MIME[ext] ?? "image/jpeg",
      });
    }
    const res = await fetch(src, { signal: AbortSignal.timeout(15_000) });
    const mime =
      res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    if (!res.ok) return undefined;
    const ext = IMAGE_MIME_TO_EXT[mime] ?? ".jpg";
    return new File([await res.arrayBuffer()], `cover${ext}`, { type: mime });
  } catch {
    return undefined;
  }
}

const exportSchema = z.object({
  patterns: standardizedPatternsSchema.shape.patterns
    .min(1)
    .max(MAX_PATTERNS_PER_CALL),
  coverSrc: z.string().nullish(),
  anthology: z.boolean(),
});

/**
 * Genera el EPUB en servidor (epub-gen-memory) y lo devuelve en base64 para
 * que el cliente lo descargue. Los patrones viajan validados contra el
 * contrato; nada toca la BD.
 */
export async function exportPatternEpub(input: {
  patterns: StandardizedPattern[];
  coverSrc?: string | null;
  anthology: boolean;
}): Promise<ExportState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const parsed = exportSchema.safeParse(input);
  if (!parsed.success) return { error: "Patrones inválidos para exportar" };

  const cover = parsed.data.coverSrc
    ? await coverFileFromSrc(parsed.data.coverSrc)
    : undefined;

  try {
    const bytes = parsed.data.anthology
      ? await toEpubAnthology(parsed.data.patterns, cover)
      : await toEpub(parsed.data.patterns[0], cover);
    return { base64: Buffer.from(bytes).toString("base64") };
  } catch {
    return { error: "No se pudo generar el EPUB, vuelve a intentarlo" };
  }
}
