import { describe, expect, it } from "vitest";
import {
  optionalFile,
  parseExpenseForm,
  parseMaterialForm,
  parseOrderForm,
  parsePatternForm,
} from "./forms";

function fd(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("parseOrderForm", () => {
  it("parsea un pedido completo y convierte euros a céntimos", () => {
    const result = parseOrderForm(
      fd({
        name: "Pulpo azul",
        description: "Con tentáculos rizados",
        quantity: "2",
        priceEur: "24.50",
        status: "EMPEZADO",
        customer: "María",
        dueDate: "2026-08-01",
        isPublic: "on",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.priceCents).toBe(2450);
    expect(result.data.quantity).toBe(2);
    expect(result.data.status).toBe("EMPEZADO");
    expect(result.data.dueDate?.getFullYear()).toBe(2026);
    expect(result.data.isPublic).toBe(true);
  });

  it("trata el centinela 'none' de los selects opcionales como null", () => {
    const result = parseOrderForm(
      fd({ name: "Rana", assignedToId: "none", patternId: "none" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.assignedToId).toBeNull();
    expect(result.data.patternId).toBeNull();
  });

  it("aplica valores por defecto (cantidad 1, sin empezar, privado)", () => {
    const result = parseOrderForm(fd({ name: "Rana" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.quantity).toBe(1);
    expect(result.data.priceCents).toBe(0);
    expect(result.data.status).toBe("SIN_EMPEZAR");
    expect(result.data.isPublic).toBe(false);
    expect(result.data.assignedToId).toBeNull();
  });

  it("rechaza un pedido sin nombre", () => {
    const result = parseOrderForm(fd({ name: "  " }));
    expect(result).toEqual({ ok: false, error: "El nombre es obligatorio" });
  });

  it("rechaza cantidades no enteras o menores que 1", () => {
    expect(parseOrderForm(fd({ name: "x", quantity: "0" })).ok).toBe(false);
    expect(parseOrderForm(fd({ name: "x", quantity: "1.5" })).ok).toBe(false);
  });

  it("rechaza precios negativos", () => {
    expect(parseOrderForm(fd({ name: "x", priceEur: "-5" })).ok).toBe(false);
  });
});

describe("parseExpenseForm", () => {
  it("calcula el total cuando no se indica", () => {
    const result = parseExpenseForm(
      fd({ item: "Lana merino", quantity: "3", unitPriceEur: "4.20", paidById: "u1" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.unitPriceCents).toBe(420);
    expect(result.data.totalCents).toBe(1260);
  });

  it("respeta un total ajustado a mano (envío, descuentos)", () => {
    const result = parseExpenseForm(
      fd({
        item: "Ojos de seguridad",
        quantity: "2",
        unitPriceEur: "3",
        totalEur: "8.50",
        paidById: "u1",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totalCents).toBe(850);
  });

  it("usa la fecha de hoy si no se indica", () => {
    const result = parseExpenseForm(fd({ item: "Relleno", paidById: "u1" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.date).toBeInstanceOf(Date);
  });

  it("exige artículo y pagador", () => {
    expect(parseExpenseForm(fd({ paidById: "u1" })).ok).toBe(false);
    expect(parseExpenseForm(fd({ item: "Lana" })).ok).toBe(false);
  });

  it("rechaza enlaces que no son URLs", () => {
    expect(
      parseExpenseForm(fd({ item: "Lana", paidById: "u1", link: "no-es-url" }))
        .ok,
    ).toBe(false);
  });
});

describe("parseMaterialForm", () => {
  it("parsea un material con color", () => {
    const result = parseMaterialForm(
      fd({
        name: "Algodón menta",
        category: "LANA",
        priceEur: "3.95",
        stock: "6.5",
        hasColor: "on",
        colorHex: "#A3E2C8",
        brand: "Katia",
        fiberType: "ALGODON",
        weight: "DK",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.priceCents).toBe(395);
    expect(result.data.stock).toBe(6.5);
    expect(result.data.colorHex).toBe("#a3e2c8");
  });

  it("descarta el color si el checkbox no está marcado", () => {
    const result = parseMaterialForm(
      fd({ name: "Tijeras", category: "HERRAMIENTAS", colorHex: "#112233" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.colorHex).toBeNull();
  });

  it("rechaza categorías desconocidas y colores inválidos", () => {
    expect(parseMaterialForm(fd({ name: "x", category: "TELA" })).ok).toBe(false);
    expect(
      parseMaterialForm(
        fd({ name: "x", category: "LANA", hasColor: "on", colorHex: "azul" }),
      ).ok,
    ).toBe(false);
  });
});

describe("parsePatternForm", () => {
  it("parsea título y enlace externo", () => {
    const result = parsePatternForm(
      fd({ title: "Pulpo clásico", externalUrl: "https://example.com/patron" }),
    );
    expect(result).toEqual({
      ok: true,
      data: { title: "Pulpo clásico", externalUrl: "https://example.com/patron" },
    });
  });

  it("exige título y valida la URL", () => {
    expect(parsePatternForm(fd({})).ok).toBe(false);
    expect(
      parsePatternForm(fd({ title: "x", externalUrl: "nourl" })).ok,
    ).toBe(false);
  });
});

describe("optionalFile", () => {
  it("trata los inputs de fichero vacíos como null", () => {
    expect(optionalFile(new File([], "vacio.png"))).toBeNull();
    expect(optionalFile(null)).toBeNull();
    expect(optionalFile("texto")).toBeNull();
  });

  it("devuelve el fichero cuando tiene contenido", () => {
    const file = new File(["datos"], "foto.png", { type: "image/png" });
    expect(optionalFile(file)).toBe(file);
  });
});
