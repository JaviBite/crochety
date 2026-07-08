import { describe, expect, it } from "vitest";
import { colorFromParam, colorToParam, normalizeSearch } from "./search";

describe("normalizeSearch", () => {
  it("recorta y devuelve undefined si queda vacío", () => {
    expect(normalizeSearch("  lana  ")).toBe("lana");
    expect(normalizeSearch("   ")).toBeUndefined();
    expect(normalizeSearch("")).toBeUndefined();
    expect(normalizeSearch(undefined)).toBeUndefined();
  });
});

describe("colorToParam", () => {
  it("quita la almohadilla y normaliza a minúsculas", () => {
    expect(colorToParam("#AABBCC")).toBe("aabbcc");
    expect(colorToParam("aabbcc")).toBe("aabbcc");
  });
});

describe("colorFromParam", () => {
  it("reconstruye el color válido con almohadilla", () => {
    expect(colorFromParam("aabbcc")).toBe("#aabbcc");
    expect(colorFromParam("#AABBCC")).toBe("#aabbcc");
  });

  it("rechaza valores que no son hex de 6 dígitos", () => {
    expect(colorFromParam("xyz")).toBeUndefined();
    expect(colorFromParam("aabb")).toBeUndefined();
    expect(colorFromParam("aabbccdd")).toBeUndefined();
    expect(colorFromParam("")).toBeUndefined();
    expect(colorFromParam(undefined)).toBeUndefined();
  });
});
