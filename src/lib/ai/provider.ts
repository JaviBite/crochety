import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

// Proveedor de LLM configurable por entorno — SOLO se usa en el servidor.
//   AI_PROVIDER: anthropic | openai | openrouter | ollama
//   AI_MODEL:    id del modelo (default: claude-opus-4-8 con anthropic)
// Las API keys (ANTHROPIC_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY)
// nunca llegan al cliente.

export const AI_PROVIDERS = [
  "anthropic",
  "openai",
  "openrouter",
  "ollama",
] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

const DEFAULT_MODEL: Record<AiProvider, string> = {
  anthropic: "claude-opus-4-8",
  openai: "gpt-5.2",
  // Router de OpenRouter que elige automáticamente un modelo gratuito
  // disponible; para fijar uno concreto, usar AI_MODEL (ids ":free").
  openrouter: "openrouter/free",
  ollama: "llama3.2",
};

export function getAiProvider(): AiProvider {
  // `||` a propósito: una variable vacía ("") también cae al valor por defecto.
  const value = process.env.AI_PROVIDER || "anthropic";
  if (!(AI_PROVIDERS as readonly string[]).includes(value)) {
    throw new Error(
      `AI_PROVIDER inválido: "${value}" (esperado: ${AI_PROVIDERS.join(" | ")})`,
    );
  }
  return value as AiProvider;
}

export function getModel(): LanguageModel {
  const provider = getAiProvider();
  const modelId = process.env.AI_MODEL || DEFAULT_MODEL[provider];

  switch (provider) {
    case "anthropic": {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error("Falta ANTHROPIC_API_KEY para AI_PROVIDER=anthropic");
      }
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(modelId);
    }
    case "openai": {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("Falta OPENAI_API_KEY para AI_PROVIDER=openai");
      }
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(modelId);
    }
    case "openrouter": {
      if (!process.env.OPENROUTER_API_KEY) {
        throw new Error("Falta OPENROUTER_API_KEY para AI_PROVIDER=openrouter");
      }
      const openrouter = createOpenAICompatible({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
        // Sin esto, generateObject no envía el json_schema (response_format)
        // y cae a "JSON por prompt", que los modelos flojos no cumplen.
        supportsStructuredOutputs: true,
      });
      return openrouter(modelId);
    }
    case "ollama": {
      // Ollama expone una API compatible con OpenAI en /v1 (con soporte de
      // salida estructurada vía response_format en versiones recientes).
      const ollama = createOpenAICompatible({
        name: "ollama",
        baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
        supportsStructuredOutputs: true,
      });
      return ollama(modelId);
    }
  }
}
