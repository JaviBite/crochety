import { describe, expect, it } from "vitest";
import {
  colorDistanceHex,
  colorFromParam,
  colorToParam,
  normalizeSearch,
  sortByColorSimilarity,
} from "./search";

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

describe("colorDistanceHex", () => {
  it("calcula la distancia euclídea entre colores RGB", () => {
    expect(colorDistanceHex("#ff0000", "#ff0000")).toBe(0);
    expect(colorDistanceHex("#ff0000", "#00ff00")).toBeGreaterThan(0);
  });
});

describe("sortByColorSimilarity", () => {
  it("ordena primero los colores más cercanos al seleccionado", () => {
    const items = [
      { id: 1, colorHex: "#000000" },
      { id: 2, colorHex: "#ff0000" },
      { id: 3, colorHex: "#00ff00" },
      { id: 4, colorHex: null },
    ];

    const sorted = sortByColorSimilarity(items, "#ff0000");

    expect(sorted[0]?.id).toBe(2);
    expect(sorted[1]?.id).toBe(1);
    expect(sorted[2]?.id).toBe(3);
    expect(sorted[3]?.id).toBe(4);
  });
});
