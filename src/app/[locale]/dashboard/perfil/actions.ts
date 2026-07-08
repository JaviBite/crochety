"use server";

import { revalidatePath } from "next/cache";
import { compare, hash } from "bcryptjs";
import { auth, updateSession } from "@/lib/auth";
import { parseProfileForm } from "@/lib/forms";
import { isUniqueViolation, prisma } from "@/lib/prisma";

export type ProfileActionState = { error: string } | { success: true } | null;

export async function updateProfile(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const parsed = parseProfileForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { name, email, currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) return { error: "Usuario no encontrado" };

  let passwordHash: string | undefined;
  if (newPassword) {
    const valid = await compare(currentPassword ?? "", user.passwordHash);
    if (!valid) return { error: "La contraseña actual no es correcta" };
    passwordHash = await hash(newPassword, 12);
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { name, email, ...(passwordHash ? { passwordHash } : {}) },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "Ese correo ya está en uso" };
    }
    throw error;
  }

  // Refresca el JWT para que el nombre/correo nuevos se vean sin re-login.
  await updateSession({ user: { name, email } });

  revalidatePath("/", "layout");
  return { success: true };
}
