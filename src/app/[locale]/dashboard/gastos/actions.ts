"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { extractExpense } from "@/lib/ai/extract-expense";
import { auth } from "@/lib/auth";
import { type ExpenseInput, parseExpenseForm } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";

export type ActionState = { error: string } | null;

type ItemCreate = {
  item: string;
  link: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  materialId: string | null;
};

/**
 * Guarda un gasto (alta o edición) en una transacción: da de alta en materiales
 * las líneas marcadas y (en edición) reemplaza por completo las líneas.
 */
async function saveExpense(data: ExpenseInput, existingId?: string) {
  const { items, ...receipt } = data;

  await prisma.$transaction(async (tx) => {
    const built: ItemCreate[] = [];
    for (const line of items) {
      let materialId: string | null = null;
      if (line.addToMaterials) {
        const material = await tx.material.create({
          data: {
            name: line.item,
            category: "OTRO",
            priceCents: line.unitPriceCents,
            stock: line.quantity,
            link: line.link,
          },
        });
        materialId = material.id;
      }
      built.push({
        item: line.item,
        link: line.link,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        totalCents: line.totalCents,
        materialId,
      });
    }

    if (existingId) {
      await tx.expense.update({
        where: { id: existingId },
        data: { ...receipt, items: { deleteMany: {}, create: built } },
      });
    } else {
      await tx.expense.create({
        data: { ...receipt, items: { create: built } },
      });
    }
  });
}

export async function createExpense(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const parsed = parseExpenseForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  await saveExpense(parsed.data);

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

  await saveExpense(parsed.data, id);

  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/gastos", locale: await getLocale() });
  return null;
}

export async function deleteExpense(
  id: string,
): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  // Las líneas (ExpenseItem) y las fotos se borran en cascada.
  await prisma.expense.delete({ where: { id } });

  revalidatePath("/", "layout");
}

// --- IA: extraer líneas desde texto o imágenes (recortadas) -----------------

export type ExtractedLine = {
  item: string;
  quantity: number;
  unitPriceEur: number | null;
  totalEur: number | null;
  link: string | null;
};

export type ExtractResult =
  | { ok: true; store: string | null; date: string | null; items: ExtractedLine[] }
  | { ok: false; error: string };

export async function extractExpenseAction(input: {
  text?: string;
  images?: string[];
}): Promise<ExtractResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado" };

  try {
    const extracted = await extractExpense(input);
    return {
      ok: true,
      store: extracted.store,
      date: extracted.date,
      items: extracted.items.map((line) => ({
        item: line.name,
        quantity: line.quantity,
        unitPriceEur: line.unitPriceEur,
        totalEur: line.totalEur,
        link: line.link,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo extraer",
    };
  }
}
