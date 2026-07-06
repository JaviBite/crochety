import { describe, expect, it } from "vitest";
import {
  type ExtractedExpense,
  extractedExpenseSchema,
  extractedItemsToLines,
} from "./extract-expense";

function extracted(items: ExtractedExpense["items"]): ExtractedExpense {
  return { store: null, date: null, items, shippingEur: null, totalEur: null };
}

describe("extractedItemsToLines", () => {
  it("calcula el total desde el precio unitario", () => {
    const [line] = extractedItemsToLines(
      extracted([
        { name: "Lana merino", quantity: 3, unitPriceEur: 4.2, totalEur: null, link: null },
      ]),
    );
    expect(line).toEqual({
      item: "Lana merino",
      quantity: 3,
      unitPriceCents: 420,
      totalCents: 1260,
      link: null,
    });
  });

  it("deriva el precio unitario desde el total de la línea", () => {
    const [line] = extractedItemsToLines(
      extracted([
        { name: "Ojos", quantity: 2, unitPriceEur: null, totalEur: 8.5, link: null },
      ]),
    );
    expect(line.unitPriceCents).toBe(425);
    expect(line.totalCents).toBe(850);
  });

  it("sanea cantidades inválidas a 1", () => {
    const [line] = extractedItemsToLines(
      extracted([
        { name: "Aguja", quantity: 0, unitPriceEur: 1.5, totalEur: null, link: null },
      ]),
    );
    expect(line.quantity).toBe(1);
    expect(line.totalCents).toBe(150);
  });

  it("pone 0 cuando no hay ningún precio y conserva el enlace", () => {
    const [line] = extractedItemsToLines(
      extracted([
        {
          name: "Relleno",
          quantity: 1,
          unitPriceEur: null,
          totalEur: null,
          link: "https://tienda.example/relleno",
        },
      ]),
    );
    expect(line.unitPriceCents).toBe(0);
    expect(line.totalCents).toBe(0);
    expect(line.link).toBe("https://tienda.example/relleno");
  });
});

describe("extractedExpenseSchema", () => {
  it("valida un objeto extraído completo", () => {
    const parsed = extractedExpenseSchema.safeParse({
      store: "Katia",
      date: "2026-07-01",
      items: [
        { name: "Lana", quantity: 2, unitPriceEur: 3.5, totalEur: 7, link: null },
      ],
      shippingEur: 2.99,
      totalEur: 9.99,
    });
    expect(parsed.success).toBe(true);
  });
});
