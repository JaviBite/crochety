import { afterEach, describe, expect, it, vi } from "vitest";
import { getAiProvider, getModel } from "./provider";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAiProvider", () => {
  it("usa anthropic por defecto", () => {
    vi.stubEnv("AI_PROVIDER", "");
    expect(getAiProvider()).toBe("anthropic");
  });

  it("lee el proveedor del entorno", () => {
    vi.stubEnv("AI_PROVIDER", "ollama");
    expect(getAiProvider()).toBe("ollama");
  });

  it("rechaza proveedores desconocidos", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    expect(() => getAiProvider()).toThrow(/AI_PROVIDER inválido/);
  });
});

describe("getModel", () => {
  it("falla con un mensaje claro si falta la API key de Anthropic", () => {
    vi.stubEnv("AI_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(() => getModel()).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("falla con un mensaje claro si falta la API key de OpenAI", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(() => getModel()).toThrow(/OPENAI_API_KEY/);
  });

  it("falla con un mensaje claro si falta la API key de OpenRouter", () => {
    vi.stubEnv("AI_PROVIDER", "openrouter");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(() => getModel()).toThrow(/OPENROUTER_API_KEY/);
  });

  it("crea el modelo de OpenRouter con la key presente", () => {
    vi.stubEnv("AI_PROVIDER", "openrouter");
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test");
    vi.stubEnv("AI_MODEL", "");
    expect(getModel()).toBeTruthy();
  });

  it("crea el modelo de Anthropic con la key presente", () => {
    vi.stubEnv("AI_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("AI_MODEL", "");
    expect(getModel()).toBeTruthy();
  });

  it("crea el modelo de Ollama sin necesidad de API key", () => {
    vi.stubEnv("AI_PROVIDER", "ollama");
    expect(getModel()).toBeTruthy();
  });
});
