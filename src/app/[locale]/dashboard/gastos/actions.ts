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
