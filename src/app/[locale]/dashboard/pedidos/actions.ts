"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { deleteUpload, saveUpload, UploadError } from "@/lib/files";
import { optionalFile, parseOrderForm } from "@/lib/forms";
import { isForeignKeyViolation, prisma } from "@/lib/prisma";

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

  const { materials, ...data } = parsed.data;
  try {
    await prisma.order.create({
      data: {
        ...data,
        photos: photoPath
          ? { create: { path: photoPath, isCover: true } }
          : undefined,
        materials: materials.length ? { create: materials } : undefined,
      },
    });
  } catch (error) {
    // Un material seleccionado pudo borrarse entre abrir el form y guardar.
    if (isForeignKeyViolation(error)) {
      return { error: "Alguno de los materiales ya no existe" };
    }
    throw error;
  }

  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/pedidos", locale: await getLocale() });
  return null; // inalcanzable: redirect() lanza NEXT_REDIRECT
}

export async function updateOrder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el identificador" };

  const parsed = parseOrderForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const existing = await prisma.order.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { error: "Pedido no encontrado" };

  let newPhotoPath: string | null = null;
  const photo = optionalFile(formData.get("photo"));
  try {
    if (photo) newPhotoPath = await saveUpload("orders", photo);
  } catch (error) {
    if (error instanceof UploadError) return { error: error.message };
    throw error;
  }

  // Si hay foto nueva, reemplaza la portada anterior (registro + fichero).
  let oldCoverPaths: string[] = [];
  if (newPhotoPath) {
    const covers = await prisma.orderPhoto.findMany({
      where: { orderId: id, isCover: true },
      select: { path: true },
    });
    oldCoverPaths = covers.map((cover) => cover.path);
    await prisma.orderPhoto.deleteMany({
      where: { orderId: id, isCover: true },
    });
  }

  const { materials, ...data } = parsed.data;
  try {
    await prisma.order.update({
      where: { id },
      data: {
        ...data,
        // Se reemplazan por completo las líneas de material del pedido.
        materials: { deleteMany: {}, create: materials },
        ...(newPhotoPath
          ? { photos: { create: { path: newPhotoPath, isCover: true } } }
          : {}),
      },
    });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return { error: "Alguno de los materiales ya no existe" };
    }
    throw error;
  }

  for (const path of oldCoverPaths) await deleteUpload(path);

  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/pedidos", locale: await getLocale() });
  return null;
}

export async function deleteOrder(
  id: string,
): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const photos = await prisma.orderPhoto.findMany({
    where: { orderId: id },
    select: { path: true },
  });

  // OrderPhoto y OrderMaterial se borran en cascada.
  await prisma.order.delete({ where: { id } });

  for (const photo of photos) await deleteUpload(photo.path);
  revalidatePath("/", "layout");
}
