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

// Grosor/tipo de fibra de lana: conjunto cerrado en la UI (Select) pero el
// parser sigue aceptando cualquier string para no romper los valores
// históricos en texto libre (en edición se ofrecen como opción extra).
export const YARN_FIBERS = [
  "Algodón",
  "Acrílico",
  "Velvet",
  "Milk cotton",
  "Lana",
  "Bambú",
  "Mezcla",
] as const;

export const YARN_WEIGHTS = [
  "Fingering",
  "Light",
  "DK",
  "Worsted",
  "Aran",
  "Bulky",
  "Super bulky",
] as const;

// --- Ubicaciones de materiales (Setting `locations`, JSON array) -------------

export const MAX_LOCATIONS = 50;
export const MAX_LOCATION_LENGTH = 60;

/**
 * Parsea el valor del Setting `locations` (JSON array de strings) de forma
 * tolerante: acepta ya-array o string JSON, recorta, deduplica y descarta
 * elementos inválidos sin lanzar.
 */
export function parseLocationsJson(raw: unknown): string[] {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const value = item.trim().slice(0, MAX_LOCATION_LENGTH);
    if (value && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
    if (out.length >= MAX_LOCATIONS) break;
  }
  return out;
}

export const PATTERN_AI_STATUSES = [
  "NONE",
  "PENDING",
  "PROCESSING",
  "DONE",
  "ERROR",
  // La IA detectó varios patrones en el origen; el usuario elige cuáles guardar.
  "MULTIPLE",
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

/** Sugerencias típicas por proveedor para el campo de modelo (Ajustes). */
export const SUGGESTED_AI_MODELS: Record<AiProvider, string[]> = {
  anthropic: [
    "claude-opus-4-8",
    "claude-sonnet-4-6",
    "claude-haiku-4-6",
  ],
  openai: ["gpt-5.2", "gpt-5-mini", "gpt-4.1-mini"],
  openrouter: [
    "openrouter/free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "meta-llama/llama-4-maverick:free",
    "google/gemini-2.5-flash:free",
  ],
  ollama: ["llama3.2", "qwen3:8b", "gemma3:4b"],
};
