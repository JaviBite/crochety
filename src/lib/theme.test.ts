import { describe, expect, it } from "vitest";
import { ACCENTS, DEFAULT_ACCENT, parseAccent } from "./theme";

describe("parseAccent", () => {
  it("acepta todos los acentos válidos", () => {
    for (const accent of ACCENTS) {
      expect(parseAccent(accent)).toBe(accent);
    }
  });

  it("devuelve el acento por defecto para valores inválidos", () => {
    expect(parseAccent("neon")).toBe(DEFAULT_ACCENT);
    expect(parseAccent("")).toBe(DEFAULT_ACCENT);
    expect(parseAccent(undefined)).toBe(DEFAULT_ACCENT);
  });
});
