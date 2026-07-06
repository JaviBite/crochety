"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { saveUpload, UploadError } from "@/lib/files";
import { optionalFile, parsePatternForm } from "@/lib/forms";
import { prisma } from "@/lib/prisma";

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

  await prisma.pattern.create({
    data: { ...parsed.data, filePath, coverImagePath },
  });

  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/patrones", locale: await getLocale() });
  return null; // inalcanzable: redirect() lanza NEXT_REDIRECT
}
