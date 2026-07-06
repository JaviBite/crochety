import { describe, expect, it } from "vitest";
import { centsToEur, eurToCents, formatCents } from "./money";

describe("eurToCents", () => {
  it("convierte euros a céntimos enteros", () => {
    expect(eurToCents(19.99)).toBe(1999);
    expect(eurToCents(0)).toBe(0);
    expect(eurToCents(1)).toBe(100);
  });

  it("redondea imprecisiones de coma flotante", () => {
    // 0.1 + 0.2 === 0.30000000000000004
    expect(eurToCents(0.1 + 0.2)).toBe(30);
    // 29.97 * 100 === 2996.9999999999995
    expect(eurToCents(29.97)).toBe(2997);
  });
});

describe("centsToEur", () => {
  it("convierte céntimos a euros", () => {
    expect(centsToEur(1999)).toBe(19.99);
    expect(centsToEur(0)).toBe(0);
  });
});

describe("formatCents", () => {
  it("formatea en EUR con locale español", () => {
    const result = formatCents(123456, "es");
    expect(result).toContain("€");
    expect(result).toMatch(/1234,56|1\.234,56/);
  });

  it("formatea en EUR con locale inglés", () => {
    const result = formatCents(123456, "en");
    expect(result).toContain("€");
    expect(result).toMatch(/1,234\.56/);
  });

  it("formatea cantidades negativas (balances)", () => {
    expect(formatCents(-500, "es")).toMatch(/-/);
  });
});
