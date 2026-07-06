import { describe, expect, it } from "vitest";
import {
  colorHexSchema,
  materialCategorySchema,
  orderStatusSchema,
  PUBLIC_ORDER_STATUSES,
} from "./validations";

describe("orderStatusSchema", () => {
  it("acepta los estados válidos", () => {
    for (const status of ["SIN_EMPEZAR", "EMPEZADO", "TERMINADO", "COBRADO"]) {
      expect(orderStatusSchema.parse(status)).toBe(status);
    }
  });

  it("rechaza estados desconocidos", () => {
    expect(() => orderStatusSchema.parse("EN_PAUSA")).toThrow();
    expect(() => orderStatusSchema.parse("terminado")).toThrow();
  });
});

describe("PUBLIC_ORDER_STATUSES", () => {
  it("solo publica pedidos terminados o cobrados", () => {
    expect(PUBLIC_ORDER_STATUSES).toEqual(["TERMINADO", "COBRADO"]);
  });
});

describe("materialCategorySchema", () => {
  it("acepta las categorías válidas", () => {
    expect(materialCategorySchema.parse("LANA")).toBe("LANA");
    expect(materialCategorySchema.parse("HERRAMIENTAS")).toBe("HERRAMIENTAS");
  });

  it("rechaza categorías desconocidas", () => {
    expect(() => materialCategorySchema.parse("TELA")).toThrow();
  });
});

describe("colorHexSchema", () => {
  it("acepta colores #RRGGBB", () => {
    expect(colorHexSchema.parse("#aabbcc")).toBe("#aabbcc");
    expect(colorHexSchema.parse("#FF00A1")).toBe("#FF00A1");
  });

  it("rechaza formatos inválidos", () => {
    expect(() => colorHexSchema.parse("aabbcc")).toThrow();
    expect(() => colorHexSchema.parse("#abc")).toThrow();
    expect(() => colorHexSchema.parse("#gghhii")).toThrow();
  });
});
