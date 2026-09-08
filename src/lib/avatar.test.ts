import { describe, expect, it } from "vitest";
import { avatarHue, initialsOf } from "./avatar";

describe("initialsOf", () => {
  it("toma primera y última inicial", () => {
    expect(initialsOf("Alba Pérez")).toBe("AP");
    expect(initialsOf("maría lópez gil")).toBe("MG");
  });

  it("con una sola palabra devuelve una inicial", () => {
    expect(initialsOf("Natalia")).toBe("N");
  });

  it("normaliza espacios y maneja vacíos", () => {
    expect(initialsOf("  Ana  ")).toBe("A");
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
  });
});

describe("avatarHue", () => {
  it("es estable para el mismo nombre", () => {
    expect(avatarHue("Alba")).toBe(avatarHue("Alba"));
  });

  it("devuelve un tono válido 0-359 y reparte colores distintos", () => {
    const hue = avatarHue("Alba");
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
    expect(avatarHue("Alba")).not.toBe(avatarHue("Natalia"));
  });

  it("maneja nombres con acentos y caracteres multibyte", () => {
    expect(avatarHue("María Guzmán")).toBeGreaterThanOrEqual(0);
    expect(avatarHue("María Guzmán")).toBeLessThan(360);
  });
});
