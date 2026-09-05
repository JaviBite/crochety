"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import {
  parseStandardizedPatternsContent,
  standardizedPatternSchema,
  standardizePatternFromContent,
} from "@/lib/ai/standardize-pattern";
import { auth } from "@/lib/auth";
import { isValidUploadPath } from "@/lib/files";
import { deleteUpload } from "@/lib/files.server";
import { checkbox, parsePatternForm } from "@/lib/forms";
import {
  collectCoverCandidates,
  derivePatternCover,
  loadPatternImages,
  parseImagePaths,
  PatternSourceError,
  saveChosenCover,
  type PatternSource,
} from "@/lib/pattern-source";
import {
  createPatternSiblings,
  deleteUploadIfUnreferenced,
  SIBLING_ORIGIN_SELECT,
  standardizeAndSave,
  toSource,
} from "@/lib/patterns/standardize-persist";
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

// ---------------------------------------------------------------------------
// Pipeline IA: la lógica de persistencia (standardizeAndSave, hermanos,
// borrados protegidos) vive en lib/patterns/standardize-persist.ts, compartida
// con la ruta de streaming /api/patterns/[id]/standardize.
// ---------------------------------------------------------------------------

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
          ...SIBLING_ORIGIN_SELECT,
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
      await standardizeAndSave(id, toSource(pattern), pattern);
    } catch {
      await prisma.pattern
        .update({ where: { id }, data: { aiStatus: "ERROR" } })
        .catch(() => {});
    }
  });
}

/** (Re)estandariza bajo demanda: la ruta /api/patterns/[id]/standardize hace
 *  el trabajo en streaming (mismo pipeline + persistencia compartidos); aquí
 *  solo queda la orquestación en segundo plano del alta/edición. */

// ---------------------------------------------------------------------------
// Revisión human-in-the-loop (aiStatus MULTIPLE): la IA detectó varios
// patrones en el origen y el usuario decide cuáles conservar.
// ---------------------------------------------------------------------------

/** Se queda solo con el patrón elegido de la lista; el resto se descarta. */
export async function keepPattern(
  id: string,
  index: number,
): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const pattern = await prisma.pattern.findUnique({
    where: { id },
    select: { aiStatus: true, standardizedContent: true },
  });
  if (!pattern) return { error: "Patrón no encontrado" };
  if (pattern.aiStatus !== "MULTIPLE") {
    return { error: "El patrón no está en revisión" };
  }
  const chosen = parseStandardizedPatternsContent(pattern.standardizedContent)[
    index
  ];
  if (!chosen) return { error: "Ese patrón ya no está en la lista" };

  await prisma.pattern.update({
    where: { id },
    data: { standardizedContent: JSON.stringify(chosen), aiStatus: "DONE" },
  });
  revalidatePath("/", "layout");
}

/**
 * Se queda con todos: el primero conserva el patrón actual (título, tags,
 * fichero) y el resto se crean como Patterns hermanos que comparten el origen.
 */
export async function keepAllPatterns(
  id: string,
): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const pattern = await prisma.pattern.findUnique({
    where: { id },
    select: {
      aiStatus: true,
      standardizedContent: true,
      ...SIBLING_ORIGIN_SELECT,
    },
  });
  if (!pattern) return { error: "Patrón no encontrado" };
  if (pattern.aiStatus !== "MULTIPLE") {
    return { error: "El patrón no está en revisión" };
  }
  const patterns = parseStandardizedPatternsContent(pattern.standardizedContent);
  if (patterns.length < 2) {
    return { error: "Ese patrón ya no está en revisión" };
  }

  await prisma.pattern.update({
    where: { id },
    data: {
      standardizedContent: JSON.stringify(patterns[0]),
      aiStatus: "DONE",
    },
  });
  await createPatternSiblings(pattern, patterns);
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

  let patterns;
  try {
    const images = imagePaths.length ? await loadPatternImages(imagePaths) : [];
    patterns = await standardizePatternFromContent({ text, images });
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

  if (patterns.length === 0) {
    await prisma.pattern
      .update({ where: { id }, data: { aiStatus: "ERROR" } })
      .catch(() => {});
    for (const path of imagePaths) await deleteUpload(path);
    return { error: "No se detectó ningún patrón en el contenido" };
  }

  await prisma.pattern.update({
    where: { id },
    data: {
      standardizedContent:
        patterns.length === 1
          ? JSON.stringify(patterns[0])
          : JSON.stringify({ patterns }),
      aiStatus: patterns.length === 1 ? "DONE" : "MULTIPLE",
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
    await deleteUploadIfUnreferenced(pattern.coverImagePath, id);
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
  // Un solo selector para todo el lote: si algún PDF contiene varios patrones,
  // crearlos todos (true) o dejarlos en MULTIPLE para revisión (false).
  const autoSplit = checkbox(formData.get("autoSplit"));

  for (const entry of entries) {
    const pattern = await prisma.pattern.create({
      data: {
        title: entry.title,
        filePath: entry.filePath,
        aiStatus: "PENDING",
        autoSplit,
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

  // Los ficheros antiguos pueden estar compartidos con hermanos multi-patrón:
  // solo se borran del storage si ningún otro patrón los sigue usando.
  if (newFilePath) await deleteUploadIfUnreferenced(existing.filePath, id);
  if (newImagePaths.length) {
    for (const old of parseImagePaths(existing.imagePaths)) {
      await deleteUploadIfUnreferenced(old, id);
    }
  }
  if (newCoverPath) await deleteUploadIfUnreferenced(existing.coverImagePath, id);
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

  await deleteUploadIfUnreferenced(pattern?.filePath);
  await deleteUploadIfUnreferenced(pattern?.coverImagePath);
  for (const img of parseImagePaths(pattern?.imagePaths)) {
    await deleteUploadIfUnreferenced(img);
  }
  revalidatePath("/", "layout");
}
