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

export const USER_ROLES = ["ADMIN", "USER"] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

// Proveedor de LLM. Las constantes viven aquí (y no en lib/ai/provider.ts)
// porque también las necesita el panel de ajustes en el cliente, sin arrastrar
// los SDKs de IA al bundle.
export const AI_PROVIDERS = [
  "anthropic",
  "openai",
  "openrouter",
  "ollama",
] as const;
export const aiProviderSchema = z.enum(AI_PROVIDERS);
export type AiProvider = z.infer<typeof aiProviderSchema>;

export const DEFAULT_AI_MODEL: Record<AiProvider, string> = {
  anthropic: "claude-opus-4-8",
  openai: "gpt-5.2",
  // Router de OpenRouter que elige automáticamente un modelo gratuito
  // disponible; para fijar uno concreto, usar el ajuste de modelo (ids ":free").
  openrouter: "openrouter/free",
  ollama: "llama3.2",
};
