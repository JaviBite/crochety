import { generateObject } from "ai";
import { z } from "zod";
import { eurToCents } from "@/lib/money";
import { getModel } from "./provider";

// ---------------------------------------------------------------------------
// Agente de extracción de gastos.
// A partir de una captura (web/email de pedido/ticket) o de un texto pegado,
// extrae las líneas de la compra. La UI las revisa antes de guardar; una compra
// (Expense) puede tener varias líneas (ExpenseItem).
// ---------------------------------------------------------------------------

export const extractedExpenseSchema = z.object({
  store: z.string().nullable().describe("Tienda o proveedor, si aparece"),
  date: z
    .string()
    .nullable()
    .describe("Fecha de la compra en formato YYYY-MM-DD, si aparece"),
  items: z
    .array(
      z.object({
        name: z.string().describe("Nombre del producto comprado"),
        quantity: z
          .number()
          .describe("Unidades compradas (1 si no se indica)"),
        unitPriceEur: z
          .number()
          .nullable()
          .describe("Precio por unidad en euros, si se conoce"),
        totalEur: z
          .number()
          .nullable()
          .describe("Total de la línea en euros, si se conoce"),
        link: z.string().nullable().describe("URL del producto, si aparece"),
      }),
    )
    .describe("Productos comprados, una entrada por producto"),
  shippingEur: z
    .number()
    .nullable()
    .describe("Gastos de envío en euros, si aparecen aparte"),
  totalEur: z
    .number()
    .nullable()
    .describe("Total pagado en euros, si aparece"),
});

export type ExtractedExpense = z.infer<typeof extractedExpenseSchema>;

export type ExpenseLine = {
  item: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  link: string | null;
};

/**
 * Convierte el resultado de la IA en líneas listas para el formulario (dinero
 * en céntimos). Deriva precio unitario ↔ total cuando falta uno, y sanea la
 * cantidad (mínimo 1, entera). Función pura → testeable sin llamar al modelo.
 */
export function extractedItemsToLines(extracted: ExtractedExpense): ExpenseLine[] {
  return extracted.items.map((item) => {
    const quantity =
      Number.isFinite(item.quantity) && item.quantity >= 1
        ? Math.round(item.quantity)
        : 1;

    let unitPriceCents: number;
    if (item.unitPriceEur != null) {
      unitPriceCents = eurToCents(item.unitPriceEur);
    } else if (item.totalEur != null) {
      unitPriceCents = eurToCents(item.totalEur / quantity);
    } else {
      unitPriceCents = 0;
    }

    const totalCents =
      item.totalEur != null ? eurToCents(item.totalEur) : unitPriceCents * quantity;

    return {
      item: item.name,
      quantity,
      unitPriceCents,
      totalCents,
      link: item.link ?? null,
    };
  });
}

const SYSTEM_PROMPT = `Eres un asistente que registra las compras de material de un
taller de crochet/amigurumi. Recibirás una captura de pantalla (de una web de
tienda, un email de confirmación de pedido o un ticket) y/o un texto pegado.

Extrae las líneas de la compra: un elemento por producto, con su cantidad y su
precio. Devuelve los importes en euros. Si un dato no aparece en el original,
usa null; NO inventes productos ni precios. Si te dan una imagen recortada,
céntrate en lo que se ve en ella.`;

type UserContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string };

/**
 * Extrae los datos de un gasto a partir de texto y/o imágenes (data URLs o
 * URLs). Requiere un modelo con visión si se pasan imágenes.
 */
export async function extractExpense(input: {
  text?: string | null;
  images?: string[];
}): Promise<ExtractedExpense> {
  const content: UserContentPart[] = [];
  if (input.text?.trim()) {
    content.push({ type: "text", text: input.text.trim() });
  }
  for (const image of input.images ?? []) {
    content.push({ type: "image", image });
  }
  if (content.length === 0) {
    throw new Error("Se necesita un texto o una imagen para extraer el gasto");
  }

  const { object } = await generateObject({
    model: getModel(),
    schema: extractedExpenseSchema,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });
  return object;
}
