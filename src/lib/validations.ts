import { z } from "zod";

// SQLite no soporta enums de Prisma: los valores válidos se definen aquí y se
// validan con zod en cada server action / route handler que escriba en la BD.

export const ORDER_STATUSES = [
  "SIN_EMPEZAR",
  "EMPEZADO",
  "TERMINADO",
  "COBRADO",
] as const;
export const orderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

/** Estados cuyo contenido puede aparecer en el portfolio público. */
export const PUBLIC_ORDER_STATUSES: OrderStatus[] = ["TERMINADO", "COBRADO"];

export const MATERIAL_CATEGORIES = [
  "LANA",
  "OJOS",
  "RELLENO",
  "HERRAMIENTAS",
  "OTRO",
] as const;
export const materialCategorySchema = z.enum(MATERIAL_CATEGORIES);
export type MaterialCategory = z.infer<typeof materialCategorySchema>;

export const PATTERN_AI_STATUSES = [
  "NONE",
  "PENDING",
  "PROCESSING",
  "DONE",
  "ERROR",
] as const;
export const patternAiStatusSchema = z.enum(PATTERN_AI_STATUSES);
export type PatternAiStatus = z.infer<typeof patternAiStatusSchema>;

export const colorHexSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color hex inválido (formato #RRGGBB)");
