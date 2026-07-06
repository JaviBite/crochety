import { describe, expect, it } from "vitest";
import { dominantColorHex, hexToRgb, rgbToHex } from "./color";

describe("rgbToHex", () => {
  it("formatea y hace clamp de los canales", () => {
    expect(rgbToHex(163, 226, 200)).toBe("#a3e2c8");
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
    expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
    expect(rgbToHex(-10, 300, 127.6)).toBe("#00ff80");
  });
});

describe("hexToRgb", () => {
  it("parsea con o sin # y sin distinguir mayúsculas", () => {
    expect(hexToRgb("#a3e2c8")).toEqual({ r: 163, g: 226, b: 200 });
    expect(hexToRgb("A3E2C8")).toEqual({ r: 163, g: 226, b: 200 });
  });

  it("devuelve null para valores inválidos", () => {
    expect(hexToRgb("azul")).toBeNull();
    expect(hexToRgb("#fff")).toBeNull();
  });
});

describe("dominantColorHex", () => {
  const px = (r: number, g: number, b: number, a = 255) => [r, g, b, a];

  it("devuelve el color del cubo más poblado", () => {
    const data = [
      ...px(250, 8, 8),
      ...px(248, 4, 6),
      ...px(252, 6, 2),
      ...px(10, 10, 240), // un azul minoritario
    ];
    const hex = dominantColorHex(data);
    // el promedio de los tres rojos, cuantizados al mismo cubo
    expect(hex).toBe("#fa0605");
  });

  it("ignora los píxeles casi-transparentes", () => {
    const data = [...px(0, 0, 255, 10), ...px(200, 40, 40, 255)];
    expect(dominantColorHex(data)).toBe("#c82828");
  });

  it("devuelve null si no hay píxeles válidos", () => {
    expect(dominantColorHex([...px(1, 2, 3, 0)])).toBeNull();
    expect(dominantColorHex([])).toBeNull();
  });
});
