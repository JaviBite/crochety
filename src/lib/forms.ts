import { z } from "zod";
import { eurToCents } from "@/lib/money";
import { parseTagNames } from "@/lib/tags";
import {
  materialCategorySchema,
  orderStatusSchema,
  colorHexSchema,
} from "@/lib/validations";

// ---------------------------------------------------------------------------
// Parsers de FormData para las server actions de alta.
// Devuelven un resultado discriminado para que la action muestre el error sin
// lanzar excepciones. Los importes llegan en euros y se guardan en céntimos.
// ---------------------------------------------------------------------------

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Cadena opcional: "" -> null. */
function opt(value: FormDataEntryValue | null): string | null {
  return str(value) || null;
}

// Radix Select no admite items con value="": los selects opcionales usan
// este centinela para "sin selección".
export const NONE_VALUE = "none";

/** Id opcional de un Select: "" o el centinela NONE_VALUE -> null. */
function optId(value: FormDataEntryValue | null): string | null {
  const s = str(value);
  return s && s !== NONE_VALUE ? s : null;
}

function checkbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function optDate(value: FormDataEntryValue | null): Date | null {
  const s = str(value);
  if (!s) return null;
  const date = new Date(`${s}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const eurosSchema = z.coerce
  .number({ error: "Importe inválido" })
  .min(0, "El importe no puede ser negativo");

const quantitySchema = z.coerce
  .number({ error: "Cantidad inválida" })
  .int("La cantidad debe ser un número entero")
  .min(1, "La cantidad mínima es 1");

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Formulario inválido";
}

// --- Pedido -----------------------------------------------------------------

const orderFormSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().nullable(),
  quantity: quantitySchema,
  priceEur: eurosSchema,
  status: orderStatusSchema,
  customer: z.string().nullable(),
  assignedToId: z.string().nullable(),
  patternId: z.string().nullable(),
  dueDate: z.date().nullable(),
  isPublic: z.boolean(),
});

export type OrderInput = Omit<z.infer<typeof orderFormSchema>, "priceEur"> & {
  priceCents: number;
};

export function parseOrderForm(formData: FormData): ParseResult<OrderInput> {
  const parsed = orderFormSchema.safeParse({
    name: str(formData.get("name")),
    description: opt(formData.get("description")),
    quantity: str(formData.get("quantity")) || "1",
    priceEur: str(formData.get("priceEur")) || "0",
    status: str(formData.get("status")) || "SIN_EMPEZAR",
    customer: opt(formData.get("customer")),
    assignedToId: optId(formData.get("assignedToId")),
    patternId: optId(formData.get("patternId")),
    dueDate: optDate(formData.get("dueDate")),
    isPublic: checkbox(formData.get("isPublic")),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const { priceEur, ...rest } = parsed.data;
  return { ok: true, data: { ...rest, priceCents: eurToCents(priceEur) } };
}

// --- Gasto -------------------------------------------------------------------

const expenseFormSchema = z.object({
  date: z.date().nullable(),
  item: z.string().min(1, "El artículo es obligatorio"),
  link: z.union([z.null(), z.url("El enlace no es una URL válida")]),
  quantity: quantitySchema,
  unitPriceEur: eurosSchema,
  // null PRIMERO: z.coerce.number() convertiría null en 0 y rompería el
  // cálculo automático del total.
  totalEur: z.union([z.null(), eurosSchema]),
  paidById: z.string().min(1, "Indica quién lo pagó"),
  received: z.boolean(),
  notes: z.string().nullable(),
});

export type ExpenseInput = {
  date: Date;
  item: string;
  link: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  paidById: string;
  received: boolean;
  notes: string | null;
};

export function parseExpenseForm(
  formData: FormData,
): ParseResult<ExpenseInput> {
  const totalRaw = str(formData.get("totalEur"));
  const parsed = expenseFormSchema.safeParse({
    date: optDate(formData.get("date")),
    item: str(formData.get("item")),
    link: opt(formData.get("link")),
    quantity: str(formData.get("quantity")) || "1",
    unitPriceEur: str(formData.get("unitPriceEur")) || "0",
    totalEur: totalRaw === "" ? null : totalRaw,
    paidById: str(formData.get("paidById")),
    received: checkbox(formData.get("received")),
    notes: opt(formData.get("notes")),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const { date, unitPriceEur, totalEur, ...rest } = parsed.data;
  const unitPriceCents = eurToCents(unitPriceEur);
  return {
    ok: true,
    data: {
      ...rest,
      date: date ?? new Date(),
      unitPriceCents,
      // Si no se indica el total se calcula, pero se permite ajustarlo a mano
      // (gastos de envío, descuentos...).
      totalCents:
        totalEur === null
          ? unitPriceCents * parsed.data.quantity
          : eurToCents(totalEur),
    },
  };
}

// --- Material -----------------------------------------------------------------

const materialFormSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  category: materialCategorySchema,
  priceEur: eurosSchema,
  stock: z.coerce
    .number({ error: "Stock inválido" })
    .min(0, "El stock no puede ser negativo"),
  location: z.string().nullable(),
  link: z.union([z.null(), z.url("El enlace no es una URL válida")]),
  brand: z.string().nullable(),
  fiberType: z.string().nullable(),
  weight: z.string().nullable(),
  colorHex: z.union([z.null(), colorHexSchema]),
});

export type MaterialInput = Omit<
  z.infer<typeof materialFormSchema>,
  "priceEur"
> & { priceCents: number; tags: string[] };

export function parseMaterialForm(
  formData: FormData,
): ParseResult<MaterialInput> {
  const parsed = materialFormSchema.safeParse({
    name: str(formData.get("name")),
    category: str(formData.get("category")),
    priceEur: str(formData.get("priceEur")) || "0",
    stock: str(formData.get("stock")) || "0",
    location: opt(formData.get("location")),
    link: opt(formData.get("link")),
    brand: opt(formData.get("brand")),
    fiberType: opt(formData.get("fiberType")),
    weight: opt(formData.get("weight")),
    // El color solo se guarda si el checkbox "hasColor" está marcado.
    colorHex: checkbox(formData.get("hasColor"))
      ? str(formData.get("colorHex")).toLowerCase() || null
      : null,
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const { priceEur, ...rest } = parsed.data;
  return {
    ok: true,
    data: {
      ...rest,
      priceCents: eurToCents(priceEur),
      tags: parseTagNames(formData.get("tags")),
    },
  };
}

// --- Patrón --------------------------------------------------------------------

const patternFormSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  externalUrl: z.union([z.null(), z.url("El enlace no es una URL válida")]),
});

export type PatternInput = z.infer<typeof patternFormSchema> & {
  tags: string[];
};

export function parsePatternForm(
  formData: FormData,
): ParseResult<PatternInput> {
  const parsed = patternFormSchema.safeParse({
    title: str(formData.get("title")),
    externalUrl: opt(formData.get("externalUrl")),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return {
    ok: true,
    data: { ...parsed.data, tags: parseTagNames(formData.get("tags")) },
  };
}

/** Un File de un input vacío llega con size 0: se trata como "sin fichero". */
export function optionalFile(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null;
}
