"use server";

import { revalidatePath } from "next/cache";
import {
  MAX_PATTERNS_PER_CALL,
  normalizeStandardizedPattern,
  standardizedPatternSchema,
  standardizedPatternsSchema,
  type StandardizedPattern,
} from "@/lib/ai/standardize-pattern";
import type { SourceProgress } from "@/lib/ai/standardize-source";
import { auth } from "@/lib/auth";
import { EXT_TO_MIME, IMAGE_MIME_TO_EXT, isValidUploadPath } from "@/lib/files";
import { deleteUpload, readUpload } from "@/lib/files.server";
import { saveChosenCover } from "@/lib/pattern-source";
import { toEpub, toEpubAnthology } from "@/lib/pattern-export.server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Convertidor efímero: la conversión en sí corre en POST /api/convert (con
// progreso en streaming); aquí quedan las acciones posteriores — guardar el
// patrón, exportar EPUB y limpiar portadas descartadas.

export type ConvertResult = {
  patterns: StandardizedPattern[];
  /** Portada propuesta automáticamente (mejor candidata del origen). */
  autoCover: string | null;
  /** Candidatas de portada del origen (data-URL del PDF o URL remota). */
  coverCandidates: string[];
};

export type ConvertState = ConvertResult | { error: string } | null;

export type ExportState = { base64: string } | { error: string };

/** Evento NDJSON que el route /api/convert emite durante la conversión. */
export type ConvertStreamEvent =
  | SourceProgress
  | ({ type: "done" } & ConvertResult)
  | { type: "error"; message: string };

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
