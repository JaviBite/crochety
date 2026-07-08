import { describe, expect, it } from "vitest";
import { materialsCostCents, suggestedPriceCents } from "./pricing";

describe("materialsCostCents", () => {
  it("suma precio × cantidad por línea", () => {
    expect(
      materialsCostCents([
        { priceCents: 300, quantity: 2 },
        { priceCents: 150, quantity: 1 },
      ]),
    ).toBe(750);
  });

  it("admite cantidades fraccionarias redondeando al céntimo", () => {
    // Media madeja de 2,99 € → 1,495 € → 150 céntimos.
    expect(materialsCostCents([{ priceCents: 299, quantity: 0.5 }])).toBe(150);
  });

  it("sin líneas el coste es cero", () => {
    expect(materialsCostCents([])).toBe(0);
  });
});

describe("suggestedPriceCents", () => {
  it("multiplica el coste y redondea hacia arriba a múltiplos de 0,50 €", () => {
    // 3,10 € × 3 = 9,30 € → sugerido 9,50 €.
    expect(suggestedPriceCents(310, 3)).toBe(950);
  });

  it("no toca los importes que ya caen en un múltiplo de 0,50 €", () => {
    expect(suggestedPriceCents(500, 3)).toBe(1500);
  });

  it("devuelve 0 con coste o multiplicador no positivos", () => {
    expect(suggestedPriceCents(0, 3)).toBe(0);
    expect(suggestedPriceCents(500, 0)).toBe(0);
    expect(suggestedPriceCents(500, -1)).toBe(0);
  });
});
