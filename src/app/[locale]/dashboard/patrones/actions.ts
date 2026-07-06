"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { deleteUpload, saveUpload, UploadError } from "@/lib/files";
import { optionalFile, parsePatternForm } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { tagsCreateInput, tagsUpdateInput } from "@/lib/tags";

export type ActionState = { error: string } | null;

export async function createPattern(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const parsed = parsePatternForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  let filePath: string | null = null;
  let coverImagePath: string | null = null;
  const file = optionalFile(formData.get("file"));
  const cover = optionalFile(formData.get("cover"));
  try {
    if (file) filePath = await saveUpload("patterns", file);
    if (cover) coverImagePath = await saveUpload("patterns", cover);
  } catch (error) {
    if (error instanceof UploadError) return { error: error.message };
    throw error;
  }

  const { tags, ...data } = parsed.data;
  await prisma.pattern.create({
    data: { ...data, filePath, coverImagePath, tags: tagsCreateInput(tags) },
  });

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
    select: { filePath: true, coverImagePath: true },
  });
  if (!existing) return { error: "Patrón no encontrado" };

  // Los ficheros solo se reemplazan si se suben nuevos; si no, se conservan.
  let newFilePath: string | null = null;
  let newCoverPath: string | null = null;
  const file = optionalFile(formData.get("file"));
  const cover = optionalFile(formData.get("cover"));
  try {
    if (file) newFilePath = await saveUpload("patterns", file);
    if (cover) newCoverPath = await saveUpload("patterns", cover);
  } catch (error) {
    if (error instanceof UploadError) return { error: error.message };
    throw error;
  }

  const { tags, ...data } = parsed.data;
  await prisma.pattern.update({
    where: { id },
    data: {
      ...data,
      ...(newFilePath ? { filePath: newFilePath } : {}),
      ...(newCoverPath ? { coverImagePath: newCoverPath } : {}),
      tags: tagsUpdateInput(tags),
    },
  });

  if (newFilePath) await deleteUpload(existing.filePath);
  if (newCoverPath) await deleteUpload(existing.coverImagePath);

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
