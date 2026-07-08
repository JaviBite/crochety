"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { UploadError } from "@/lib/files";
import { deleteUpload, saveUpload } from "@/lib/files.server";
import { optionalFile, parseMaterialForm } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { tagsCreateInput, tagsUpdateInput } from "@/lib/tags";

export type ActionState = { error: string } | null;

export async function createMaterial(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const parsed = parseMaterialForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  let photoPath: string | null = null;
  const photo = optionalFile(formData.get("photo"));
  try {
    if (photo) photoPath = await saveUpload("materials", photo);
  } catch (error) {
    if (error instanceof UploadError) return { error: error.message };
    throw error;
  }

  const { tags, ...data } = parsed.data;
  await prisma.material.create({
    data: { ...data, photoPath, tags: tagsCreateInput(tags) },
  });

  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/materiales", locale: await getLocale() });
  return null; // inalcanzable: redirect() lanza NEXT_REDIRECT
}

export async function updateMaterial(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el identificador" };

  const parsed = parseMaterialForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const existing = await prisma.material.findUnique({
    where: { id },
    select: { photoPath: true },
  });
  if (!existing) return { error: "Material no encontrado" };

  // Solo se reemplaza la foto si se sube una nueva; si no, se conserva.
  let newPhotoPath: string | null = null;
  const photo = optionalFile(formData.get("photo"));
  try {
    if (photo) newPhotoPath = await saveUpload("materials", photo);
  } catch (error) {
    if (error instanceof UploadError) return { error: error.message };
    throw error;
  }

  const { tags, ...data } = parsed.data;
  await prisma.material.update({
    where: { id },
    data: {
      ...data,
      ...(newPhotoPath ? { photoPath: newPhotoPath } : {}),
      tags: tagsUpdateInput(tags),
    },
  });

  if (newPhotoPath) await deleteUpload(existing.photoPath);

  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/materiales", locale: await getLocale() });
  return null;
}

export async function deleteMaterial(
  id: string,
): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const material = await prisma.material.findUnique({
    where: { id },
    select: { photoPath: true },
  });

  try {
    // El m2m con Tag se limpia en cascada; OrderMaterial no, así que un material
    // en uso en algún pedido no se puede borrar (FK).
    await prisma.material.delete({ where: { id } });
  } catch {
    return { error: "No se puede borrar: el material está en uso en un pedido" };
  }

  await deleteUpload(material?.photoPath);
  revalidatePath("/", "layout");
}
