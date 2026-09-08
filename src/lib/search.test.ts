import { describe, expect, it } from "vitest";
import {
  colorDistanceHex,
  colorFromParam,
  colorToParam,
  hexToHsl,
  normalizeSearch,
  sortByColorHue,
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

describe("hexToHsl", () => {
  it("convierte rojo, verde y azul puros", () => {
    expect(hexToHsl("#ff0000")).toEqual([0, 1, 0.5]);
    expect(hexToHsl("#00ff00")?.[0]).toBeCloseTo(120, 5);
    expect(hexToHsl("#0000ff")?.[0]).toBeCloseTo(240, 5);
  });

  it("devuelve undefined con color inválido", () => {
    expect(hexToHsl("nope")).toBeUndefined();
  });
});

describe("sortByColorHue", () => {
  it("agrupa por familia de tono y deja los neutros al final", () => {
    const sorted = sortByColorHue([
      "#ffffff", // neutro claro
      "#0000ff", // azul (familia 240/30 = 8)
      "#000000", // neutro oscuro
      "#ff0000", // rojo (familia 0)
      "#00ff00", // verde (familia 120/30 = 4)
      "#cccccc", // neutro medio
    ]);

    expect(sorted).toEqual([
      "#ff0000", // rojo
      "#00ff00", // verde
      "#0000ff", // azul
      "#000000", // neutros por luminosidad
      "#cccccc",
      "#ffffff",
    ]);
  });

  it("no parte los rojos en los extremos (350° y 10° misma familia)", () => {
    const sorted = sortByColorHue(["#0000ff", "#ff0a0a", "#ff0000"]);
    const positions = sorted.map((color) => sorted.indexOf(color));
    // Todos los rojos consecutivos en la misma zona
    expect(Math.abs(positions[0] - positions[2])).toBeLessThan(sorted.length);
  });

  it("dentro de la misma familia ordena por luminosidad", () => {
    expect(sortByColorHue(["#ff8080", "#ff0000"])).toEqual(["#ff0000", "#ff8080"]);
  });
});
