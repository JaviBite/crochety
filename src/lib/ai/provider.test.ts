import { describe, expect, it, vi } from "vitest";
import type { AiConfig } from "@/lib/settings";
import { buildModel } from "./provider";

// provider → settings → prisma: se corta la cadena para no instanciar el cliente.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

function config(partial: Partial<AiConfig>): AiConfig {
  return {
    provider: "anthropic",
    modelId: null,
    apiKey: null,
    ollamaBaseUrl: null,
    ...partial,
  };
}

describe("buildModel", () => {
  it("falla con un mensaje claro si falta la clave de Anthropic", () => {
    expect(() => buildModel(config({ provider: "anthropic" }))).toThrow(
      /Anthropic/,
    );
  });

  it("falla con un mensaje claro si falta la clave de OpenAI", () => {
    expect(() => buildModel(config({ provider: "openai" }))).toThrow(/OpenAI/);
  });

  it("falla con un mensaje claro si falta la clave de OpenRouter", () => {
    expect(() => buildModel(config({ provider: "openrouter" }))).toThrow(
      /OpenRouter/,
    );
  });

  it("crea el modelo de Anthropic con la clave presente", () => {
    expect(
      buildModel(config({ provider: "anthropic", apiKey: "sk-test" })),
    ).toBeTruthy();
  });

  it("crea el modelo de OpenRouter con la clave presente", () => {
    expect(
      buildModel(config({ provider: "openrouter", apiKey: "sk-or-test" })),
    ).toBeTruthy();
  });

  it("crea el modelo de Ollama sin necesidad de clave API", () => {
    expect(buildModel(config({ provider: "ollama" }))).toBeTruthy();
  });
});
