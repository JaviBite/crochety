"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { extractExpense } from "@/lib/ai/extract-expense";
import { auth } from "@/lib/auth";
import {
  deleteUpload,
  IMAGE_MIME_TO_EXT,
  isValidUploadPath,
  MAX_IMAGE_BYTES,
  saveUpload,
} from "@/lib/files";
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

function readStringArray(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

// Descarga una imagen de una URL y la sube al almacenamiento; null si falla o
// no es una imagen válida (best-effort, no debe tumbar el guardado del gasto).
async function savePhotoFromUrl(rawUrl: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!(type in IMAGE_MIME_TO_EXT)) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;
    return await saveUpload("expenses", new File([bytes], "compra", { type }));
  } catch {
    return null;
  }
}

// Fotos del formulario → pathnames: las ya subidas (photoPaths) se validan; los
// enlaces (photoLinks) se descargan y suben.
async function resolvePhotos(formData: FormData): Promise<string[]> {
  const paths = readStringArray(formData.get("photoPaths")).filter(isValidUploadPath);
  const links = readStringArray(formData.get("photoLinks"));
  const fetched = await Promise.all(links.map(savePhotoFromUrl));
  return [...paths, ...fetched.filter((path): path is string => path !== null)];
}

/**
 * Guarda un gasto (alta o edición) en una transacción: da de alta en materiales
 * las líneas marcadas, y reemplaza líneas y fotos en edición. Los blobs que
 * dejan de estar referenciados se borran tras la transacción.
 */
async function saveExpense(
  data: ExpenseInput,
  photoPaths: string[],
  existingId?: string,
) {
  const { items, ...receipt } = data;

  let removedPaths: string[] = [];
  if (existingId) {
    const existing = await prisma.expensePhoto.findMany({
      where: { expenseId: existingId },
      select: { path: true },
    });
    const keep = new Set(photoPaths);
    removedPaths = existing.map((photo) => photo.path).filter((p) => !keep.has(p));
  }

  const photoCreate = photoPaths.map((path) => ({ path }));

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
        data: {
          ...receipt,
          items: { deleteMany: {}, create: built },
          photos: { deleteMany: {}, create: photoCreate },
        },
      });
    } else {
      await tx.expense.create({
        data: {
          ...receipt,
          items: { create: built },
          photos: { create: photoCreate },
        },
      });
    }
  });

  for (const path of removedPaths) await deleteUpload(path);
}

export async function createExpense(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const parsed = parseExpenseForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  await saveExpense(parsed.data, await resolvePhotos(formData));

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

  await saveExpense(parsed.data, await resolvePhotos(formData), id);

  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/gastos", locale: await getLocale() });
  return null;
}

export async function deleteExpense(
  id: string,
): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const photos = await prisma.expensePhoto.findMany({
    where: { expenseId: id },
    select: { path: true },
  });

  // Las líneas (ExpenseItem) y las filas de fotos se borran en cascada.
  await prisma.expense.delete({ where: { id } });

  for (const photo of photos) await deleteUpload(photo.path);
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
