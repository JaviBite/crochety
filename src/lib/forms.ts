import { z } from "zod";
import { eurToCents } from "@/lib/money";
import { parseTagNames } from "@/lib/tags";
import { ACCENTS } from "@/lib/theme";
import {
  aiProviderSchema,
  materialCategorySchema,
  orderStatusSchema,
  colorHexSchema,
  userRoleSchema,
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

// Materiales usados en el pedido (base de la calculadora de precio). Llegan
// serializados en el campo oculto `materials` como JSON; tolerante con
// cantidades raras (caen a 1).
const orderMaterialSchema = z.object({
  materialId: z.string().trim().min(1),
  quantity: z.coerce.number().positive().catch(1),
});

export type OrderMaterialInput = z.infer<typeof orderMaterialSchema>;

/** Líneas válidas y sin duplicados (mismo material → se suman cantidades). */
function parseOrderMaterials(raw: FormDataEntryValue | null): OrderMaterialInput[] {
  const byId = new Map<string, OrderMaterialInput>();
  for (const entry of parseItemsJson(raw)) {
    const parsed = orderMaterialSchema.safeParse(entry);
    if (!parsed.success) continue;
    const existing = byId.get(parsed.data.materialId);
    if (existing) {
      existing.quantity += parsed.data.quantity;
    } else {
      byId.set(parsed.data.materialId, parsed.data);
    }
  }
  return [...byId.values()];
}

export type OrderInput = Omit<z.infer<typeof orderFormSchema>, "priceEur"> & {
  priceCents: number;
  materials: OrderMaterialInput[];
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
  return {
    ok: true,
    data: {
      ...rest,
      priceCents: eurToCents(priceEur),
      materials: parseOrderMaterials(formData.get("materials")),
    },
  };
}

// --- Gasto (compra/recibo con varias líneas) --------------------------------

// Una línea llega desde el cliente en euros (el form serializa el array en un
// campo oculto `items` como JSON). Tolerante: los importes/cantidades inválidos
// caen a un valor por defecto porque pueden venir de la extracción por IA.
const expenseItemSchema = z.object({
  item: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).catch(1),
  unitPriceEur: z.coerce.number().min(0).catch(0),
  totalEur: z.union([z.null(), z.coerce.number().min(0)]).catch(null),
  link: z.union([z.null(), z.string()]).catch(null),
  addToMaterials: z.boolean().catch(false),
});

export type ExpenseItemInput = {
  item: string;
  link: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  addToMaterials: boolean;
};

export type ExpenseInput = {
  date: Date;
  store: string | null;
  paidById: string;
  shippingCents: number;
  totalCents: number;
  received: boolean;
  notes: string | null;
  items: ExpenseItemInput[];
};

/** Euros crudos (string) → céntimos, saneando NaN/negativos a 0. */
function eurStrToCents(value: FormDataEntryValue | null): number {
  const eur = Number.parseFloat(str(value));
  return Number.isFinite(eur) && eur > 0 ? eurToCents(eur) : 0;
}

function parseItemsJson(raw: FormDataEntryValue | null): unknown[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseExpenseForm(
  formData: FormData,
): ParseResult<ExpenseInput> {
  const paidById = str(formData.get("paidById"));
  if (!paidById) return { ok: false, error: "Indica quién lo pagó" };

  const rawItems = parseItemsJson(formData.get("items"));
  if (rawItems.length === 0) {
    return { ok: false, error: "Añade al menos un producto" };
  }

  const items: ExpenseItemInput[] = [];
  for (const raw of rawItems) {
    const parsed = expenseItemSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Hay un producto sin nombre" };
    }
    const { item, quantity, unitPriceEur, totalEur, link, addToMaterials } =
      parsed.data;

    let unitPriceCents: number;
    if (unitPriceEur > 0) {
      unitPriceCents = eurToCents(unitPriceEur);
    } else if (totalEur != null) {
      unitPriceCents = eurToCents(totalEur / quantity);
    } else {
      unitPriceCents = 0;
    }
    const totalCents =
      totalEur != null ? eurToCents(totalEur) : unitPriceCents * quantity;

    items.push({
      item,
      link: link?.trim() ? link.trim() : null,
      quantity,
      unitPriceCents,
      totalCents,
      addToMaterials,
    });
  }

  const shippingCents = eurStrToCents(formData.get("shippingEur"));
  const itemsTotal = items.reduce((sum, line) => sum + line.totalCents, 0);
  // El total se autocalcula (líneas + envío) pero se permite ajustarlo a mano.
  const totalRaw = str(formData.get("totalEur"));
  const totalCents =
    totalRaw === "" ? itemsTotal + shippingCents : eurStrToCents(totalRaw);

  return {
    ok: true,
    data: {
      date: optDate(formData.get("date")) ?? new Date(),
      store: opt(formData.get("store")),
      paidById,
      shippingCents,
      totalCents,
      received: checkbox(formData.get("received")),
      notes: opt(formData.get("notes")),
      items,
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

// --- Perfil y usuarios --------------------------------------------------------

const MIN_PASSWORD_LENGTH = 8;

/** Contraseña opcional: sin trim (los espacios pueden ser intencionados). */
function optPassword(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

const emailSchema = z
  .email("El correo no es válido")
  .transform((email) => email.toLowerCase());

const newPasswordSchema = z.union([
  z.null(),
  z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
    ),
]);

const profileFormSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  email: emailSchema,
  currentPassword: z.string().nullable(),
  newPassword: newPasswordSchema,
});

export type ProfileInput = z.infer<typeof profileFormSchema>;

export function parseProfileForm(
  formData: FormData,
): ParseResult<ProfileInput> {
  const parsed = profileFormSchema.safeParse({
    name: str(formData.get("name")),
    email: str(formData.get("email")),
    currentPassword: optPassword(formData.get("currentPassword")),
    newPassword: optPassword(formData.get("newPassword")),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  if (parsed.data.newPassword && !parsed.data.currentPassword) {
    return {
      ok: false,
      error: "Introduce tu contraseña actual para cambiarla",
    };
  }
  return { ok: true, data: parsed.data };
}

const userFormSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  email: emailSchema,
  role: userRoleSchema,
  password: newPasswordSchema,
});

export type UserInput = z.infer<typeof userFormSchema>;

/** Alta/edición de usuario (admin). En el alta la contraseña es obligatoria. */
export function parseUserForm(
  formData: FormData,
  { requirePassword }: { requirePassword: boolean },
): ParseResult<UserInput> {
  const parsed = userFormSchema.safeParse({
    name: str(formData.get("name")),
    email: str(formData.get("email")),
    role: str(formData.get("role")) || "USER",
    password: optPassword(formData.get("password")),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  if (requirePassword && !parsed.data.password) {
    return { ok: false, error: "La contraseña es obligatoria" };
  }
  return { ok: true, data: parsed.data };
}

// --- Ajustes (panel de administración) ---------------------------------------

const settingsFormSchema = z.object({
  workshopName: z.string().nullable(),
  workshopTagline: z.string().nullable(),
  galleryEnabled: z.boolean(),
  defaultAccent: z.enum(ACCENTS),
  aiProvider: aiProviderSchema,
  aiModel: z.string().nullable(),
  // Solo del proveedor seleccionado; en blanco = conservar la guardada.
  apiKey: z.string().nullable(),
  clearApiKey: z.boolean(),
  ollamaBaseUrl: z.union([z.null(), z.url("El enlace no es una URL válida")]),
});

export type SettingsInput = z.infer<typeof settingsFormSchema>;

export function parseSettingsForm(
  formData: FormData,
): ParseResult<SettingsInput> {
  const parsed = settingsFormSchema.safeParse({
    workshopName: opt(formData.get("workshopName")),
    workshopTagline: opt(formData.get("workshopTagline")),
    galleryEnabled: checkbox(formData.get("galleryEnabled")),
    defaultAccent: str(formData.get("defaultAccent")),
    aiProvider: str(formData.get("aiProvider")),
    aiModel: opt(formData.get("aiModel")),
    apiKey: optPassword(formData.get("apiKey")),
    clearApiKey: checkbox(formData.get("clearApiKey")),
    ollamaBaseUrl: opt(formData.get("ollamaBaseUrl")),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return { ok: true, data: parsed.data };
}
