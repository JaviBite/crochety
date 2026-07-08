import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { getAiConfig, type AiConfig } from "@/lib/settings";
import { DEFAULT_AI_MODEL } from "@/lib/validations";

// Proveedor de LLM configurable — SOLO se usa en el servidor.
// La configuración sale de los ajustes en BD con fallback a env (lib/settings):
//   aiProvider (AI_PROVIDER): anthropic | openai | openrouter | ollama
//   aiModel    (AI_MODEL):    id del modelo (default por proveedor)
// Las claves API (ajustes enmascarados o *_API_KEY) nunca llegan al cliente.

export { AI_PROVIDERS, type AiProvider } from "@/lib/validations";

/** Construye el LanguageModel a partir de una config ya resuelta (puro, testeable). */
export function buildModel(config: AiConfig): LanguageModel {
  const modelId = config.modelId || DEFAULT_AI_MODEL[config.provider];

  switch (config.provider) {
    case "anthropic": {
      if (!config.apiKey) {
        throw new Error(
          "Falta la clave API de Anthropic (ajustes o ANTHROPIC_API_KEY)",
        );
      }
      return createAnthropic({ apiKey: config.apiKey })(modelId);
    }
    case "openai": {
      if (!config.apiKey) {
        throw new Error(
          "Falta la clave API de OpenAI (ajustes o OPENAI_API_KEY)",
        );
      }
      return createOpenAI({ apiKey: config.apiKey })(modelId);
    }
    case "openrouter": {
      if (!config.apiKey) {
        throw new Error(
          "Falta la clave API de OpenRouter (ajustes o OPENROUTER_API_KEY)",
        );
      }
      const openrouter = createOpenAICompatible({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: config.apiKey,
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
        baseURL: config.ollamaBaseUrl ?? "http://localhost:11434/v1",
        supportsStructuredOutputs: true,
      });
      return ollama(modelId);
    }
  }
}

/** Modelo activo según los ajustes (BD → env → defaults). */
export async function getModel(): Promise<LanguageModel> {
  return buildModel(await getAiConfig());
}
