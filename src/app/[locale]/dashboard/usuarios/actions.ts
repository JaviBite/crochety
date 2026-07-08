"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth, isAdmin } from "@/lib/auth";
import { parseUserForm } from "@/lib/forms";
import {
  isForeignKeyViolation,
  isUniqueViolation,
  prisma,
} from "@/lib/prisma";

export type ActionState = { error: string } | null;

export async function createUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!isAdmin(session)) return { error: "No autorizado" };

  const parsed = parseUserForm(formData, { requirePassword: true });
  if (!parsed.ok) return { error: parsed.error };
  const { name, email, role, password } = parsed.data;

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        role,
        passwordHash: await hash(password!, 12),
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "Ese correo ya está en uso" };
    throw error;
  }

  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/usuarios", locale: await getLocale() });
  return null; // inalcanzable: redirect() lanza NEXT_REDIRECT
}

export async function updateUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!isAdmin(session)) return { error: "No autorizado" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el identificador" };

  const parsed = parseUserForm(formData, { requirePassword: false });
  if (!parsed.ok) return { error: parsed.error };
  const { name, email, role, password } = parsed.data;

  // Evita quedarse sin acceso al panel: nadie se quita su propio rol admin.
  if (id === session!.user.id && role !== "ADMIN") {
    return { error: "No puedes quitarte tu propio rol de administración" };
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { error: "Usuario no encontrado" };

  try {
    await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        role,
        ...(password ? { passwordHash: await hash(password, 12) } : {}),
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "Ese correo ya está en uso" };
    throw error;
  }

  // El rol y el nombre viajan en el JWT: la persona editada verá los cambios
  // al volver a iniciar sesión.
  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/usuarios", locale: await getLocale() });
  return null;
}

export async function deleteUser(
  id: string,
): Promise<{ error: string } | void> {
  const session = await auth();
  if (!isAdmin(session)) return { error: "No autorizado" };
  if (id === session!.user.id) {
    return { error: "No puedes borrar tu propio usuario" };
  }

  try {
    await prisma.user.delete({ where: { id } });
  } catch (error) {
    // Expense.paidBy es una relación obligatoria (Restrict en la BD).
    if (isForeignKeyViolation(error)) {
      return {
        error: "Tiene gastos a su nombre: reasígnalos antes de borrarlo",
      };
    }
    throw error;
  }

  revalidatePath("/", "layout");
}
