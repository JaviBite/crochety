import { describe, expect, it } from "vitest";
import {
  optionalFile,
  parseExpenseForm,
  parseMaterialForm,
  parseOrderForm,
  parsePatternForm,
  parseProfileForm,
  parseSettingsForm,
  parseUserForm,
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
  const items = (arr: unknown[]) => JSON.stringify(arr);

  it("parsea un recibo con varias líneas y calcula el total", () => {
    const result = parseExpenseForm(
      fd({
        paidById: "u1",
        shippingEur: "2.99",
        items: items([
          { item: "Lana", quantity: 3, unitPriceEur: 4.2, totalEur: null, link: null, addToMaterials: true },
          { item: "Ojos", quantity: 2, unitPriceEur: 0, totalEur: 8.5, link: "https://x.example", addToMaterials: false },
        ]),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(2);
    expect(result.data.items[0]).toMatchObject({
      item: "Lana",
      quantity: 3,
      unitPriceCents: 420,
      totalCents: 1260,
      addToMaterials: true,
    });
    expect(result.data.items[1]).toMatchObject({
      unitPriceCents: 425,
      totalCents: 850,
      link: "https://x.example",
    });
    expect(result.data.shippingCents).toBe(299);
    expect(result.data.totalCents).toBe(1260 + 850 + 299);
  });

  it("respeta un total ajustado a mano", () => {
    const result = parseExpenseForm(
      fd({
        paidById: "u1",
        totalEur: "20",
        items: items([
          { item: "x", quantity: 1, unitPriceEur: 5, totalEur: null, link: null, addToMaterials: false },
        ]),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totalCents).toBe(2000);
  });

  it("usa la fecha de hoy si no se indica", () => {
    const result = parseExpenseForm(
      fd({
        paidById: "u1",
        items: items([
          { item: "Relleno", quantity: 1, unitPriceEur: 1, totalEur: null, link: null, addToMaterials: false },
        ]),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.date).toBeInstanceOf(Date);
  });

  it("exige pagador y al menos un producto", () => {
    const oneItem = items([
      { item: "x", quantity: 1, unitPriceEur: 1, totalEur: null, link: null, addToMaterials: false },
    ]);
    expect(parseExpenseForm(fd({ items: oneItem })).ok).toBe(false);
    expect(parseExpenseForm(fd({ paidById: "u1", items: "[]" })).ok).toBe(false);
    expect(parseExpenseForm(fd({ paidById: "u1" })).ok).toBe(false);
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

  it("normaliza los tags recibidos", () => {
    const result = parseMaterialForm(
      fd({ name: "Lana", category: "LANA", tags: "Verde, verde ,Suave" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.tags).toEqual(["verde", "suave"]);
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
      data: {
        title: "Pulpo clásico",
        externalUrl: "https://example.com/patron",
        tags: [],
      },
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

describe("parseOrderForm (materiales)", () => {
  it("parsea las líneas de material y suma duplicados", () => {
    const result = parseOrderForm(
      fd({
        name: "Pulpo",
        materials: JSON.stringify([
          { materialId: "m1", quantity: 2 },
          { materialId: "m2", quantity: 0.5 },
          { materialId: "m1", quantity: 1 },
        ]),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.materials).toEqual([
      { materialId: "m1", quantity: 3 },
      { materialId: "m2", quantity: 0.5 },
    ]);
  });

  it("ignora líneas inválidas y JSON corrupto", () => {
    const broken = parseOrderForm(fd({ name: "x", materials: "{{{" }));
    expect(broken.ok).toBe(true);
    if (!broken.ok) return;
    expect(broken.data.materials).toEqual([]);

    const invalid = parseOrderForm(
      fd({
        name: "x",
        materials: JSON.stringify([
          { materialId: "", quantity: 2 },
          { materialId: "ok", quantity: "raro" },
        ]),
      }),
    );
    expect(invalid.ok).toBe(true);
    if (!invalid.ok) return;
    // La cantidad no numérica cae a 1; la línea sin material se descarta.
    expect(invalid.data.materials).toEqual([{ materialId: "ok", quantity: 1 }]);
  });
});

describe("parseProfileForm", () => {
  it("normaliza el correo y acepta el cambio de contraseña completo", () => {
    const result = parseProfileForm(
      fd({
        name: "Ana",
        email: "  Ana@Taller.ES ",
        currentPassword: "la-actual",
        newPassword: "nueva-clave-larga",
      }),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        name: "Ana",
        email: "ana@taller.es",
        currentPassword: "la-actual",
        newPassword: "nueva-clave-larga",
      },
    });
  });

  it("exige la contraseña actual para cambiarla", () => {
    const result = parseProfileForm(
      fd({ name: "Ana", email: "ana@taller.es", newPassword: "12345678" }),
    );
    expect(result.ok).toBe(false);
  });

  it("rechaza contraseñas nuevas cortas y correos inválidos", () => {
    expect(
      parseProfileForm(
        fd({
          name: "Ana",
          email: "ana@taller.es",
          currentPassword: "x",
          newPassword: "corta",
        }),
      ).ok,
    ).toBe(false);
    expect(parseProfileForm(fd({ name: "Ana", email: "noesmail" })).ok).toBe(
      false,
    );
  });
});

describe("parseUserForm", () => {
  it("en el alta la contraseña es obligatoria", () => {
    const sinClave = parseUserForm(
      fd({ name: "Bea", email: "bea@taller.es", role: "USER" }),
      { requirePassword: true },
    );
    expect(sinClave.ok).toBe(false);

    const conClave = parseUserForm(
      fd({
        name: "Bea",
        email: "bea@taller.es",
        role: "ADMIN",
        password: "12345678",
      }),
      { requirePassword: true },
    );
    expect(conClave).toEqual({
      ok: true,
      data: {
        name: "Bea",
        email: "bea@taller.es",
        role: "ADMIN",
        password: "12345678",
      },
    });
  });

  it("en edición la contraseña es opcional y el rol se valida", () => {
    const result = parseUserForm(
      fd({ name: "Bea", email: "bea@taller.es", role: "USER" }),
      { requirePassword: false },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.password).toBeNull();

    expect(
      parseUserForm(
        fd({ name: "Bea", email: "bea@taller.es", role: "JEFA" }),
        { requirePassword: false },
      ).ok,
    ).toBe(false);
  });
});

describe("parseSettingsForm", () => {
  it("parsea el formulario completo de ajustes", () => {
    const result = parseSettingsForm(
      fd({
        workshopName: "Taller Lanero",
        workshopTagline: "",
        galleryEnabled: "on",
        defaultAccent: "lavender",
        aiProvider: "openrouter",
        aiModel: "openrouter/free",
        apiKey: "sk-or-123",
        ollamaBaseUrl: "",
      }),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        workshopName: "Taller Lanero",
        workshopTagline: null,
        galleryEnabled: true,
        defaultAccent: "lavender",
        aiProvider: "openrouter",
        aiModel: "openrouter/free",
        apiKey: "sk-or-123",
        clearApiKey: false,
        ollamaBaseUrl: null,
      },
    });
  });

  it("rechaza proveedores y acentos desconocidos", () => {
    const base = {
      defaultAccent: "mint",
      aiProvider: "anthropic",
    };
    expect(
      parseSettingsForm(fd({ ...base, aiProvider: "gemini" })).ok,
    ).toBe(false);
    expect(
      parseSettingsForm(fd({ ...base, defaultAccent: "fucsia" })).ok,
    ).toBe(false);
  });
});
