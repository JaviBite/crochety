import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { parseAccent, type Accent } from "@/lib/theme";
import {
  AI_PROVIDERS,
  DEFAULT_AI_MODEL,
  type AiProvider,
} from "@/lib/validations";

// ---------------------------------------------------------------------------
// Configuración editable en runtime (modelo Setting, clave-valor) con fallback
// a las variables de entorno: la BD manda; si no hay fila, se usa el env.
// SOLO servidor: las claves API jamás salen de aquí hacia el cliente.
// ---------------------------------------------------------------------------

export const SETTING_KEYS = [
  "workshopName",
  "workshopTagline",
  "galleryEnabled",
  "defaultAccent",
  "aiProvider",
  "aiModel",
  "aiApiKeyAnthropic",
  "aiApiKeyOpenai",
  "aiApiKeyOpenrouter",
  "ollamaBaseUrl",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export const DEFAULT_WORKSHOP_NAME = "Zgz Stitches";

/** Variable de entorno que actúa de fallback para cada clave (si existe). */
const ENV_FALLBACK: Partial<Record<SettingKey, string>> = {
  aiProvider: "AI_PROVIDER",
  aiModel: "AI_MODEL",
  aiApiKeyAnthropic: "ANTHROPIC_API_KEY",
  aiApiKeyOpenai: "OPENAI_API_KEY",
  aiApiKeyOpenrouter: "OPENROUTER_API_KEY",
  ollamaBaseUrl: "OLLAMA_BASE_URL",
};

const API_KEY_SETTING: Record<
  Exclude<AiProvider, "ollama">,
  SettingKey
> = {
  anthropic: "aiApiKeyAnthropic",
  openai: "aiApiKeyOpenai",
  openrouter: "aiApiKeyOpenrouter",
};

/** Clave de ajuste donde se guarda la API key de cada proveedor. */
export function apiKeySettingFor(
  provider: Exclude<AiProvider, "ollama">,
): SettingKey {
  return API_KEY_SETTING[provider];
}

/**
 * Lee todas las filas de Setting una sola vez por petición (React cache).
 * Los valores vacíos se tratan como "sin ajuste" (cae al env/default).
 */
const getStoredSettings = cache(
  async (): Promise<Partial<Record<SettingKey, string>>> => {
    const rows = await prisma.setting.findMany();
    const known = new Set<string>(SETTING_KEYS);
    const out: Partial<Record<SettingKey, string>> = {};
    for (const row of rows) {
      if (known.has(row.key) && row.value.trim()) {
        out[row.key as SettingKey] = row.value;
      }
    }
    return out;
  },
);

/** Valor efectivo de un ajuste: BD → variable de entorno → null. */
export async function getSetting(key: SettingKey): Promise<string | null> {
  const stored = await getStoredSettings();
  if (stored[key] != null) return stored[key];
  const envName = ENV_FALLBACK[key];
  // `||`: una variable definida pero vacía también cae al siguiente nivel.
  return (envName && process.env[envName]) || null;
}

/**
 * Guarda un lote de ajustes: string → upsert; null → borrar la fila (vuelve
 * al fallback de env). Los valores se recortan; "" equivale a borrar.
 */
export async function saveSettings(
  entries: Partial<Record<SettingKey, string | null>>,
): Promise<void> {
  const ops = [];
  for (const [key, raw] of Object.entries(entries)) {
    const value = raw?.trim() || null;
    ops.push(
      value === null
        ? prisma.setting.deleteMany({ where: { key } })
        : prisma.setting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
          }),
    );
  }
  if (ops.length) await prisma.$transaction(ops);
}

// --- Helpers tipados para los consumidores ----------------------------------

export type WorkshopSettings = {
  name: string;
  /** null → usar el tagline traducido por defecto de messages/. */
  tagline: string | null;
  galleryEnabled: boolean;
};

export async function getWorkshopSettings(): Promise<WorkshopSettings> {
  const [name, tagline, gallery] = await Promise.all([
    getSetting("workshopName"),
    getSetting("workshopTagline"),
    getSetting("galleryEnabled"),
  ]);
  return {
    name: name ?? DEFAULT_WORKSHOP_NAME,
    tagline,
    galleryEnabled: gallery !== "false",
  };
}

/** Acento por defecto cuando el visitante aún no tiene cookie `accent`. */
export async function getDefaultAccent(): Promise<Accent> {
  return parseAccent((await getSetting("defaultAccent")) ?? undefined);
}

export type AiConfig = {
  provider: AiProvider;
  /** null → usar el modelo por defecto del proveedor. */
  modelId: string | null;
  /** Clave API del proveedor elegido (null si no hay o no aplica). */
  apiKey: string | null;
  ollamaBaseUrl: string | null;
};

export function resolveAiProvider(value: string | null): AiProvider {
  const provider = value || "anthropic";
  if (!(AI_PROVIDERS as readonly string[]).includes(provider)) {
    throw new Error(
      `Proveedor de IA inválido: "${provider}" (esperado: ${AI_PROVIDERS.join(" | ")})`,
    );
  }
  return provider as AiProvider;
}

export async function getAiConfig(): Promise<AiConfig> {
  const provider = resolveAiProvider(await getSetting("aiProvider"));
  const apiKey =
    provider === "ollama"
      ? null
      : await getSetting(API_KEY_SETTING[provider]);
  return {
    provider,
    modelId: await getSetting("aiModel"),
    apiKey,
    ollamaBaseUrl: await getSetting("ollamaBaseUrl"),
  };
}

// --- Snapshot para el panel de administración (sin secretos) ----------------

export type ApiKeySource = "db" | "env" | null;

export type SettingsSnapshot = {
  workshopName: string;
  workshopTagline: string;
  galleryEnabled: boolean;
  defaultAccent: Accent;
  aiProvider: AiProvider;
  /** "" → se usa el modelo por defecto del proveedor. */
  aiModel: string;
  ollamaBaseUrl: string;
  /** De dónde sale cada clave API (enmascarada): BD, env o ninguna. */
  apiKeySource: Record<Exclude<AiProvider, "ollama">, ApiKeySource>;
  defaultModel: Record<AiProvider, string>;
};

/** Estado actual de los ajustes para el formulario admin. Nunca incluye claves. */
export async function getSettingsSnapshot(): Promise<SettingsSnapshot> {
  const stored = await getStoredSettings();
  const workshop = await getWorkshopSettings();

  function keySource(key: SettingKey): ApiKeySource {
    if (stored[key] != null) return "db";
    const envName = ENV_FALLBACK[key];
    return envName && process.env[envName] ? "env" : null;
  }

  let aiProvider: AiProvider;
  try {
    aiProvider = resolveAiProvider(await getSetting("aiProvider"));
  } catch {
    aiProvider = "anthropic";
  }

  return {
    workshopName: workshop.name,
    workshopTagline: workshop.tagline ?? "",
    galleryEnabled: workshop.galleryEnabled,
    defaultAccent: await getDefaultAccent(),
    aiProvider,
    aiModel: stored.aiModel ?? process.env.AI_MODEL ?? "",
    ollamaBaseUrl: (await getSetting("ollamaBaseUrl")) ?? "",
    apiKeySource: {
      anthropic: keySource("aiApiKeyAnthropic"),
      openai: keySource("aiApiKeyOpenai"),
      openrouter: keySource("aiApiKeyOpenrouter"),
    },
    defaultModel: DEFAULT_AI_MODEL,
  };
}
