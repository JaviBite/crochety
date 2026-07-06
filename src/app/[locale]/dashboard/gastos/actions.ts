"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { parseExpenseForm } from "@/lib/forms";
import { prisma } from "@/lib/prisma";

export type ActionState = { error: string } | null;

export async function createExpense(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const parsed = parseExpenseForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  await prisma.expense.create({ data: parsed.data });

  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/gastos", locale: await getLocale() });
  return null; // inalcanzable: redirect() lanza NEXT_REDIRECT
}

export async function updateExpense(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el identificador" };

  const parsed = parseExpenseForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  await prisma.expense.update({ where: { id }, data: parsed.data });

  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/gastos", locale: await getLocale() });
  return null;
}

export async function deleteExpense(
  id: string,
): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  await prisma.expense.delete({ where: { id } });

  revalidatePath("/", "layout");
}
