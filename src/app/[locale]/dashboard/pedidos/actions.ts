"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { isValidUploadPath } from "@/lib/files";
import { deleteUpload } from "@/lib/files.server";
import { parseOrderForm } from "@/lib/forms";
import { isForeignKeyViolation, prisma } from "@/lib/prisma";

export type ActionState = { error: string } | null;

/** Lee `photoPath` del form: "" = sin foto; pathname válido = foto subida. */
function readPhotoPath(formData: FormData): string | null {
  const raw = String(formData.get("photoPath") ?? "").trim();
  return raw && isValidUploadPath(raw) ? raw : null;
}

export async function createOrder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const parsed = parseOrderForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  // Tolerancias del parser: rastro en logs (el usuario ya ve los avisos
  // en ámbar en el form antes de enviar).
  if (parsed.warning) console.warn("[form]", parsed.warning);

  const photoPath = readPhotoPath(formData);

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
  // Tolerancias del parser: rastro en logs (el usuario ya ve los avisos
  // en ámbar en el form antes de enviar).
  if (parsed.warning) console.warn("[form]", parsed.warning);

  const photoPath = readPhotoPath(formData);
  const existing = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      photos: { where: { isCover: true }, select: { path: true } },
    },
  });
  if (!existing) return { error: "Pedido no encontrado" };

  // La foto (pathname) solo cambia si el form envía una distinta de la
  // guardada; "" significa "la quitaron" → se limpia el registro y el fichero.
  const currentCoverPath = existing.photos[0]?.path ?? null;
  const coverChanged = photoPath !== currentCoverPath;
  const oldCoverPath =
    coverChanged && currentCoverPath ? currentCoverPath : null;

  const { materials, ...data } = parsed.data;
  try {
    await prisma.order.update({
      where: { id },
      data: {
        ...data,
        // Se reemplazan por completo las líneas de material del pedido.
        materials: { deleteMany: {}, create: materials },
        ...(coverChanged
          ? {
              photos: photoPath
                ? {
                    deleteMany: { isCover: true },
                    create: { path: photoPath, isCover: true },
                  }
                : { deleteMany: { isCover: true } },
            }
          : {}),
      },
    });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return { error: "Alguno de los materiales ya no existe" };
    }
    throw error;
  }

  if (oldCoverPath) await deleteUpload(oldCoverPath);

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
