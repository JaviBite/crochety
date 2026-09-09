"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { isValidUploadPath } from "@/lib/files";
import { deleteUpload } from "@/lib/files.server";
import { parseMaterialForm } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { tagsCreateInput, tagsUpdateInput } from "@/lib/tags";

export type ActionState = { error: string } | null;

/** Lee `photoPath` del form: "" = sin foto; pathname válido = foto subida. */
function readPhotoPath(formData: FormData): string | null {
  const raw = String(formData.get("photoPath") ?? "").trim();
  return raw && isValidUploadPath(raw) ? raw : null;
}

export async function createMaterial(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const parsed = parseMaterialForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  // La foto ya está subida a /api/uploads (ImageUploadField): llega el pathname.
  const photoPath = readPhotoPath(formData);

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

  // La foto llega como pathname ya subido; "" = la quitaron. Si cambió, la
  // acción limpia el fichero anterior del storage.
  const photoPath = readPhotoPath(formData);
  const photoChanged = photoPath !== (existing.photoPath ?? null);

  const { tags, ...data } = parsed.data;
  await prisma.material.update({
    where: { id },
    data: {
      ...data,
      ...(photoChanged ? { photoPath } : {}),
      tags: tagsUpdateInput(tags),
    },
  });

  if (photoChanged && existing.photoPath) {
    await deleteUpload(existing.photoPath);
  }

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
