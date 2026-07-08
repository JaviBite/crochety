"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import {
  standardizedPatternSchema,
  standardizePattern,
  standardizePatternFromContent,
  standardizePatternFromImages,
} from "@/lib/ai/standardize-pattern";
import { auth } from "@/lib/auth";
import { deleteUpload, isValidUploadPath } from "@/lib/files";
import { parsePatternForm } from "@/lib/forms";
import {
  collectCoverCandidates,
  derivePatternCover,
  extractPatternText,
  loadPatternImages,
  parseImagePaths,
  PatternSourceError,
  saveChosenCover,
  type PatternSource,
} from "@/lib/pattern-source";
import { prisma } from "@/lib/prisma";
import { parseTagNames, tagsCreateInput, tagsUpdateInput } from "@/lib/tags";
import { z } from "zod";

export type ActionState = { error: string } | null;

// Los ficheros se suben desde el cliente vía /api/uploads (el body de las
// server actions está limitado a 1 MB); aquí solo llega el pathname relativo.
function uploadedPath(value: FormDataEntryValue | null): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s && isValidUploadPath(s) && s.startsWith("patterns/") ? s : null;
}

/** Campo oculto `imagePaths` (JSON) → pathnames de patrón válidos (máx. 12). */
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

/** Fila de BD → PatternSource (parsea la columna JSON imagePaths). */
function toSource(row: {
  filePath: string | null;
  externalUrl: string | null;
  imagePaths: string | null;
}): PatternSource {
  return {
    filePath: row.filePath,
    externalUrl: row.externalUrl,
    imagePaths: parseImagePaths(row.imagePaths),
  };
}

// ---------------------------------------------------------------------------
// Pipeline IA: extraer texto del origen → standardizePattern → guardar JSON.
// aiStatus: PENDING (en cola) → PROCESSING → DONE | ERROR.
// ---------------------------------------------------------------------------

async function standardizeAndSave(id: string, source: PatternSource) {
  const images = source.imagePaths ?? [];
  // Con imágenes va por visión; si no, se extrae texto del PDF/DOCX/web.
  const standardized = images.length
    ? await standardizePatternFromImages(await loadPatternImages(images))
    : await standardizePattern(await extractPatternText(source));
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
 * desde la página del patrón. En el alta en batch la portada también se deriva
 * aquí (hacerlo en la respuesta multiplicaría la espera por cada fichero).
 */
function schedulePatternStandardization(
  id: string,
  { deriveCover = false }: { deriveCover?: boolean } = {},
) {
  after(async () => {
    try {
      const pattern = await prisma.pattern.findUnique({
        where: { id },
        select: {
          filePath: true,
          externalUrl: true,
          imagePaths: true,
          coverImagePath: true,
        },
      });
      if (!pattern) return;
      await prisma.pattern.update({
        where: { id },
        data: { aiStatus: "PROCESSING" },
      });
      if (deriveCover && !pattern.coverImagePath) {
        const cover = await derivePatternCover(toSource(pattern));
        if (cover) {
          await prisma.pattern.update({
            where: { id },
            data: { coverImagePath: cover },
          });
        }
      }
      await standardizeAndSave(id, toSource(pattern));
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
    select: { filePath: true, externalUrl: true, imagePaths: true },
  });
  if (!pattern) return { error: "Patrón no encontrado" };
  const source = toSource(pattern);
  if (!source.filePath && !source.externalUrl && !source.imagePaths?.length) {
    return { error: "El patrón no tiene fichero, imágenes ni enlace" };
  }

  await prisma.pattern.update({
    where: { id },
    data: { aiStatus: "PROCESSING" },
  });
  try {
    await standardizeAndSave(id, source);
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

/**
 * Estandariza a partir de texto y/o imágenes pegados a mano (no del origen
 * guardado del patrón): útil cuando el fichero/enlace falla o no existe.
 * Las imágenes ya llegan subidas a /api/uploads (mismo esquema que el resto
 * de subidas) y se borran tras usarlas: son de un solo uso, no se guardan
 * como fuente del patrón.
 */
export async function standardizePatternManual(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el identificador" };

  const text = String(formData.get("text") ?? "").trim();
  const imagePaths = uploadedImagePaths(formData.get("imagePaths"));
  if (!text && imagePaths.length === 0) {
    return { error: "Añade texto o al menos una imagen" };
  }

  const pattern = await prisma.pattern.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!pattern) return { error: "Patrón no encontrado" };

  await prisma.pattern.update({
    where: { id },
    data: { aiStatus: "PROCESSING" },
  });

  let standardized;
  try {
    const images = imagePaths.length ? await loadPatternImages(imagePaths) : [];
    standardized = await standardizePatternFromContent({ text, images });
  } catch (error) {
    await prisma.pattern
      .update({ where: { id }, data: { aiStatus: "ERROR" } })
      .catch(() => {});
    for (const path of imagePaths) await deleteUpload(path);
    return {
      error:
        error instanceof PatternSourceError
          ? error.message
          : "La estandarización falló, vuelve a intentarlo",
    };
  }

  await prisma.pattern.update({
    where: { id },
    data: {
      standardizedContent: JSON.stringify(standardized),
      aiStatus: "DONE",
    },
  });
  for (const path of imagePaths) await deleteUpload(path);

  revalidatePath("/", "layout");
  redirect({ href: `/dashboard/patrones/${id}`, locale: await getLocale() });
  return null;
}

/**
 * Guarda el contenido estandarizado editado online. El editor manda el JSON
 * completo en el campo `content`; se revalida contra el contrato antes de
 * persistirlo (lo que se guarda siempre cumple el esquema).
 */
export async function updatePatternContent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el identificador" };

  const raw = formData.get("content");
  let json: unknown;
  try {
    json = JSON.parse(typeof raw === "string" ? raw : "");
  } catch {
    return { error: "Contenido inválido" };
  }
  const parsed = standardizedPatternSchema.safeParse(json);
  if (!parsed.success) {
    return { error: "El patrón no cumple el formato estandarizado" };
  }

  const existing = await prisma.pattern.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { error: "Patrón no encontrado" };

  await prisma.pattern.update({
    where: { id },
    data: {
      standardizedContent: JSON.stringify(parsed.data),
      aiStatus: "DONE",
    },
  });

  revalidatePath("/", "layout");
  redirect({
    href: `/dashboard/patrones/${id}`,
    locale: await getLocale(),
  });
  return null;
}

/**
 * Imágenes candidatas a portada extraídas del origen (PDF o web), para que el
 * usuario elija en el detalle. No guarda nada: las candidatas viajan como
 * data-URL (PDF) o URL remota (web).
 */
export async function loadCoverCandidates(
  id: string,
): Promise<{ candidates: string[] } | { error: string }> {
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
  return { candidates: await collectCoverCandidates(pattern) };
}

/** Fija como portada la imagen candidata elegida por el usuario. */
export async function setPatternCover(
  id: string,
  src: string,
): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const pattern = await prisma.pattern.findUnique({
    where: { id },
    select: { coverImagePath: true },
  });
  if (!pattern) return { error: "Patrón no encontrado" };

  let newPath: string;
  try {
    newPath = await saveChosenCover(src);
  } catch (error) {
    return {
      error:
        error instanceof PatternSourceError
          ? error.message
          : "No se pudo guardar la portada",
    };
  }

  await prisma.pattern.update({
    where: { id },
    data: { coverImagePath: newPath },
  });
  if (pattern.coverImagePath && pattern.coverImagePath !== newPath) {
    await deleteUpload(pattern.coverImagePath);
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
  const imagePaths = uploadedImagePaths(formData.get("imagePaths"));
  let coverImagePath = uploadedPath(formData.get("coverPath"));

  const { tags, ...data } = parsed.data;
  const source: PatternSource = {
    filePath,
    externalUrl: data.externalUrl,
    imagePaths,
  };
  const hasSource = Boolean(filePath || data.externalUrl || imagePaths.length);

  // Portada: subida > primera imagen del patrón > derivada del PDF/web.
  if (!coverImagePath && imagePaths.length) coverImagePath = imagePaths[0];
  if (!coverImagePath && hasSource) {
    coverImagePath = await derivePatternCover(source);
  }

  const pattern = await prisma.pattern.create({
    data: {
      ...data,
      filePath,
      imagePaths: imagePaths.length ? JSON.stringify(imagePaths) : null,
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

// Cada fichero del alta en batch llega ya subido a /api/uploads: aquí solo
// viajan título + pathname, serializados en el campo oculto `entries`.
const batchEntrySchema = z.object({
  title: z.string().trim().min(1),
  filePath: z.string(),
});

export async function createPatternsBatch(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  let rawEntries: unknown;
  try {
    rawEntries = JSON.parse(String(formData.get("entries") ?? ""));
  } catch {
    rawEntries = null;
  }
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    return { error: "Añade al menos un fichero" };
  }

  const entries: { title: string; filePath: string }[] = [];
  for (const raw of rawEntries) {
    const parsed = batchEntrySchema.safeParse(raw);
    if (!parsed.success) return { error: "Hay un fichero sin título" };
    const filePath = uploadedPath(parsed.data.filePath);
    if (!filePath) return { error: "Hay un fichero inválido" };
    entries.push({ title: parsed.data.title, filePath });
  }

  const tags = parseTagNames(formData.get("tags"));

  for (const entry of entries) {
    const pattern = await prisma.pattern.create({
      data: {
        title: entry.title,
        filePath: entry.filePath,
        aiStatus: "PENDING",
        tags: tagsCreateInput(tags),
      },
    });
    // Portada y estandarización en segundo plano, patrón a patrón.
    schedulePatternStandardization(pattern.id, { deriveCover: true });
  }

  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/patrones", locale: await getLocale() });
  return null;
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
    select: {
      filePath: true,
      imagePaths: true,
      coverImagePath: true,
      externalUrl: true,
    },
  });
  if (!existing) return { error: "Patrón no encontrado" };

  // Los ficheros solo se reemplazan si se suben nuevos; si no, se conservan.
  const newFilePath = uploadedPath(formData.get("filePath"));
  const newImagePaths = uploadedImagePaths(formData.get("imagePaths"));
  let newCoverPath = uploadedPath(formData.get("coverPath"));

  const { tags, ...data } = parsed.data;
  const imagePaths = newImagePaths.length
    ? newImagePaths
    : parseImagePaths(existing.imagePaths);
  const source: PatternSource = {
    filePath: newFilePath ?? existing.filePath,
    externalUrl: data.externalUrl,
    imagePaths,
  };
  const hasSource = Boolean(
    source.filePath || source.externalUrl || imagePaths.length,
  );
  // Si cambió el origen, la versión estandarizada anterior deja de valer.
  const sourceChanged =
    Boolean(newFilePath) ||
    newImagePaths.length > 0 ||
    data.externalUrl !== existing.externalUrl;

  if (!newCoverPath && !existing.coverImagePath) {
    if (newImagePaths.length) newCoverPath = newImagePaths[0];
    else if (hasSource) newCoverPath = await derivePatternCover(source);
  }

  await prisma.pattern.update({
    where: { id },
    data: {
      ...data,
      ...(newFilePath ? { filePath: newFilePath } : {}),
      ...(newImagePaths.length
        ? { imagePaths: JSON.stringify(newImagePaths) }
        : {}),
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
  if (newImagePaths.length) {
    for (const old of parseImagePaths(existing.imagePaths)) {
      await deleteUpload(old);
    }
  }
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
    select: { filePath: true, imagePaths: true, coverImagePath: true },
  });

  // Los pedidos que lo referencian quedan con patternId = null (relación
  // opcional); el m2m con Tag se limpia en cascada.
  await prisma.pattern.delete({ where: { id } });

  await deleteUpload(pattern?.filePath);
  await deleteUpload(pattern?.coverImagePath);
  for (const img of parseImagePaths(pattern?.imagePaths)) {
    await deleteUpload(img);
  }
  revalidatePath("/", "layout");
}
