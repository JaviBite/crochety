import { describe, expect, it } from "vitest";
import { toDateInputValue, todayInputValue } from "./dates";

describe("toDateInputValue", () => {
  it("formatea YYYY-MM-DD con ceros, en zona local", () => {
    expect(toDateInputValue(new Date(2026, 0, 5, 0, 30))).toBe("2026-01-05");
    expect(toDateInputValue(new Date(2026, 11, 25, 23, 59))).toBe("2026-12-25");
  });

  it("ida y vuelta estable con el parseo local T00:00:00 del servidor", () => {
    const value = toDateInputValue(new Date(2026, 8, 6, 1, 30));
    expect(value).toBe("2026-09-06");
    // Así parsea optDate en lib/forms.ts: medianoche LOCAL del mismo día.
    expect(new Date(`${value}T00:00:00`).getDate()).toBe(6);
  });

  it("no se desfasa respecto a toISOString (el caso del bug de medianoche)", () => {
    // Un Date construido en local nunca debe cambiar de día al formatear,
    // pase lo que pase con el offset UTC de la máquina.
    for (const hour of [0, 1, 2, 12, 23]) {
      const date = new Date(2026, 5, 15, hour, 30);
      expect(toDateInputValue(date)).toBe("2026-06-15");
    }
  });
});

describe("todayInputValue", () => {
  it("coincide con el formateo local de ahora", () => {
    expect(todayInputValue()).toBe(toDateInputValue(new Date()));
  });
});
