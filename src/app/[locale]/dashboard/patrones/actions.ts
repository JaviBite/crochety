"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { standardizePattern } from "@/lib/ai/standardize-pattern";
import { auth } from "@/lib/auth";
import { deleteUpload, isValidUploadPath } from "@/lib/files";
import { parsePatternForm } from "@/lib/forms";
import {
  derivePatternCover,
  extractPatternText,
  PatternSourceError,
  type PatternSource,
} from "@/lib/pattern-source";
import { prisma } from "@/lib/prisma";
import { tagsCreateInput, tagsUpdateInput } from "@/lib/tags";

export type ActionState = { error: string } | null;

// Los ficheros se suben desde el cliente vía /api/uploads (el body de las
// server actions está limitado a 1 MB); aquí solo llega el pathname relativo.
function uploadedPath(value: FormDataEntryValue | null): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s && isValidUploadPath(s) && s.startsWith("patterns/") ? s : null;
}

// ---------------------------------------------------------------------------
// Pipeline IA: extraer texto del origen → standardizePattern → guardar JSON.
// aiStatus: PENDING (en cola) → PROCESSING → DONE | ERROR.
// ---------------------------------------------------------------------------

async function standardizeAndSave(id: string, source: PatternSource) {
  const text = await extractPatternText(source);
  const standardized = await standardizePattern(text);
  await prisma.pattern.update({
    where: { id },
    data: {
      standardizedContent: JSON.stringify(standardized),
      aiStatus: "DONE",
    },
  });
}

/**
 * Ejecuta la estandarización fuera de la respuesta (with `after`): el alta
 * redirige al instante y el estado avanza en segundo plano. Cualquier fallo
 * (incluido que el patrón ya no exista) deja ERROR y se reintenta a mano
 * desde la página del patrón.
 */
function schedulePatternStandardization(id: string) {
  after(async () => {
    try {
      const pattern = await prisma.pattern.findUnique({
        where: { id },
        select: { filePath: true, externalUrl: true },
      });
      if (!pattern) return;
      await prisma.pattern.update({
        where: { id },
        data: { aiStatus: "PROCESSING" },
      });
      await standardizeAndSave(id, pattern);
    } catch {
      await prisma.pattern
        .update({ where: { id }, data: { aiStatus: "ERROR" } })
        .catch(() => {});
    }
  });
}

/** (Re)estandariza un patrón bajo demanda desde su página de detalle. */
export async function standardizePatternAction(
  id: string,
): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const pattern = await prisma.pattern.findUnique({
    where: { id },
    select: { filePath: true, externalUrl: true },
  });
  if (!pattern) return { error: "Patrón no encontrado" };
  if (!pattern.filePath && !pattern.externalUrl) {
    return { error: "El patrón no tiene fichero ni enlace" };
  }

  await prisma.pattern.update({
    where: { id },
    data: { aiStatus: "PROCESSING" },
  });
  try {
    await standardizeAndSave(id, pattern);
  } catch (error) {
    await prisma.pattern
      .update({ where: { id }, data: { aiStatus: "ERROR" } })
      .catch(() => {});
    return {
      error:
        error instanceof PatternSourceError
          ? error.message
          : "La estandarización falló, vuelve a intentarlo",
    };
  }
  revalidatePath("/", "layout");
}

export async function createPattern(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const parsed = parsePatternForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const filePath = uploadedPath(formData.get("filePath"));
  let coverImagePath = uploadedPath(formData.get("coverPath"));

  const { tags, ...data } = parsed.data;
  const source: PatternSource = { filePath, externalUrl: data.externalUrl };
  const hasSource = Boolean(filePath || data.externalUrl);

  // Sin portada subida: se intenta derivar del origen (1ª página del PDF /
  // og:image de la web). Best-effort, nunca bloquea el alta.
  if (!coverImagePath && hasSource) {
    coverImagePath = await derivePatternCover(source);
  }

  const pattern = await prisma.pattern.create({
    data: {
      ...data,
      filePath,
      coverImagePath,
      aiStatus: hasSource ? "PENDING" : "NONE",
      tags: tagsCreateInput(tags),
    },
  });
  if (hasSource) schedulePatternStandardization(pattern.id);

  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/patrones", locale: await getLocale() });
  return null; // inalcanzable: redirect() lanza NEXT_REDIRECT
}

export async function updatePattern(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el identificador" };

  const parsed = parsePatternForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const existing = await prisma.pattern.findUnique({
    where: { id },
    select: { filePath: true, coverImagePath: true, externalUrl: true },
  });
  if (!existing) return { error: "Patrón no encontrado" };

  // Los ficheros solo se reemplazan si se suben nuevos; si no, se conservan.
  const newFilePath = uploadedPath(formData.get("filePath"));
  let newCoverPath = uploadedPath(formData.get("coverPath"));

  const { tags, ...data } = parsed.data;
  const source: PatternSource = {
    filePath: newFilePath ?? existing.filePath,
    externalUrl: data.externalUrl,
  };
  const hasSource = Boolean(source.filePath || source.externalUrl);
  // Si cambió el origen, la versión estandarizada anterior deja de valer.
  const sourceChanged =
    Boolean(newFilePath) || data.externalUrl !== existing.externalUrl;

  if (!newCoverPath && !existing.coverImagePath && hasSource) {
    newCoverPath = await derivePatternCover(source);
  }

  await prisma.pattern.update({
    where: { id },
    data: {
      ...data,
      ...(newFilePath ? { filePath: newFilePath } : {}),
      ...(newCoverPath ? { coverImagePath: newCoverPath } : {}),
      ...(sourceChanged
        ? {
            standardizedContent: null,
            aiStatus: hasSource ? "PENDING" : "NONE",
          }
        : {}),
      tags: tagsUpdateInput(tags),
    },
  });

  if (newFilePath) await deleteUpload(existing.filePath);
  if (newCoverPath) await deleteUpload(existing.coverImagePath);
  if (sourceChanged && hasSource) schedulePatternStandardization(id);

  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/patrones", locale: await getLocale() });
  return null;
}

export async function deletePattern(
  id: string,
): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const pattern = await prisma.pattern.findUnique({
    where: { id },
    select: { filePath: true, coverImagePath: true },
  });

  // Los pedidos que lo referencian quedan con patternId = null (relación
  // opcional); el m2m con Tag se limpia en cascada.
  await prisma.pattern.delete({ where: { id } });

  await deleteUpload(pattern?.filePath);
  await deleteUpload(pattern?.coverImagePath);
  revalidatePath("/", "layout");
}
