import { describe, expect, it } from "vitest";
import {
  colorHexSchema,
  materialCategorySchema,
  orderStatusSchema,
  parseLocationsJson,
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

describe("parseLocationsJson", () => {
  it("parsea el JSON del Setting y sanea los valores", () => {
    expect(parseLocationsJson('["Caja azul","Estantería 2"]')).toEqual([
      "Caja azul",
      "Estantería 2",
    ]);
    expect(parseLocationsJson('["Caja","Caja","  Caja  "]')).toEqual(["Caja"]);
    expect(parseLocationsJson('["x", " más"]')).toEqual(["x", "más"]);
  });

  it("acepta ya-array y descarta elementos no-string", () => {
    expect(parseLocationsJson(["Caja", 42, null, "Balda"])).toEqual([
      "Caja",
      "Balda",
    ]);
  });

  it("es tolerante con entradas inválidas", () => {
    expect(parseLocationsJson("no-json")).toEqual([]);
    expect(parseLocationsJson('{"no":"es-array"}')).toEqual([]);
    expect(parseLocationsJson(null)).toEqual([]);
    expect(parseLocationsJson(undefined)).toEqual([]);
    expect(parseLocationsJson(42)).toEqual([]);
  });

  it("recorta a MAX_LOCATION_LENGTH y respeta el tope MAX_LOCATIONS", () => {
    const long = "x".repeat(100);
    expect(parseLocationsJson([long])[0]).toHaveLength(60);
    const many = Array.from({ length: 60 }, (_, i) => `L${i}`);
    expect(parseLocationsJson(many)).toHaveLength(50);
  });
});
