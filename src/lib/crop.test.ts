import { describe, expect, it } from "vitest";
import { rectFromPoints, scaleCropToNatural } from "./crop";

describe("rectFromPoints", () => {
  it("normaliza dos puntos a un rect con w/h positivos", () => {
    expect(rectFromPoints({ x: 30, y: 40 }, { x: 10, y: 10 })).toEqual({
      x: 10,
      y: 10,
      width: 20,
      height: 30,
    });
  });
});

describe("scaleCropToNatural", () => {
  it("escala la selección a los píxeles reales de la imagen", () => {
    const rect = scaleCropToNatural(
      { x: 10, y: 20, width: 50, height: 40 },
      { width: 100, height: 100 },
      { width: 400, height: 400 },
    );
    expect(rect).toEqual({ x: 40, y: 80, width: 200, height: 160 });
  });

  it("recorta a los límites de la imagen", () => {
    const rect = scaleCropToNatural(
      { x: 80, y: 80, width: 40, height: 40 },
      { width: 100, height: 100 },
      { width: 100, height: 100 },
    );
    expect(rect).toEqual({ x: 80, y: 80, width: 20, height: 20 });
  });

  it("devuelve null si la selección es minúscula", () => {
    expect(
      scaleCropToNatural(
        { x: 0, y: 0, width: 2, height: 2 },
        { width: 100, height: 100 },
        { width: 100, height: 100 },
      ),
    ).toBeNull();
  });
});
