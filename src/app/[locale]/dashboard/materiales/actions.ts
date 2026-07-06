"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { saveUpload, UploadError } from "@/lib/files";
import { optionalFile, parseMaterialForm } from "@/lib/forms";
import { prisma } from "@/lib/prisma";

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

  await prisma.material.create({ data: { ...parsed.data, photoPath } });

  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/materiales", locale: await getLocale() });
  return null; // inalcanzable: redirect() lanza NEXT_REDIRECT
}
