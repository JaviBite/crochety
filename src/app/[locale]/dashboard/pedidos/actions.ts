"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { saveUpload, UploadError } from "@/lib/files";
import { optionalFile, parseOrderForm } from "@/lib/forms";
import { prisma } from "@/lib/prisma";

export type ActionState = { error: string } | null;

export async function createOrder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const parsed = parseOrderForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  let photoPath: string | null = null;
  const photo = optionalFile(formData.get("photo"));
  try {
    if (photo) photoPath = await saveUpload("orders", photo);
  } catch (error) {
    if (error instanceof UploadError) return { error: error.message };
    throw error;
  }

  await prisma.order.create({
    data: {
      ...parsed.data,
      photos: photoPath
        ? { create: { path: photoPath, isCover: true } }
        : undefined,
    },
  });

  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/pedidos", locale: await getLocale() });
  return null; // inalcanzable: redirect() lanza NEXT_REDIRECT
}
