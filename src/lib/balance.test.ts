import { describe, expect, it } from "vitest";
import { computeSettlements, type MemberBalance } from "./balance";

function member(
  id: string,
  paidCents: number,
  earnedCents: number,
): MemberBalance {
  return { id, name: id.toUpperCase(), paidCents, earnedCents };
}

describe("computeSettlements", () => {
  it("con menos de dos personas no hay deudas", () => {
    expect(computeSettlements([])).toEqual([]);
    expect(computeSettlements([member("ana", 1000, 0)])).toEqual([]);
  });

  it("quien no ha pagado nada debe la mitad del gasto", () => {
    // Ana pagó 30 € de material; a medias, Bea le debe 15 €.
    const result = computeSettlements([
      member("ana", 3000, 0),
      member("bea", 0, 0),
    ]);
    expect(result).toEqual([
      {
        from: { id: "bea", name: "BEA" },
        to: { id: "ana", name: "ANA" },
        amountCents: 1500,
      },
    ]);
  });

  it("quien cobra un pedido debe la mitad a la otra", () => {
    // Bea cobró 50 € de un pedido: 25 € son de Ana.
    const result = computeSettlements([
      member("ana", 0, 0),
      member("bea", 0, 5000),
    ]);
    expect(result).toEqual([
      {
        from: { id: "bea", name: "BEA" },
        to: { id: "ana", name: "ANA" },
        amountCents: 2500,
      },
    ]);
  });

  it("gastos e ingresos se compensan entre sí", () => {
    // Ana pagó 30 € de gastos pero cobró 20 € de pedidos:
    // le deben 15 € y debe 10 € → Bea le transfiere 5 €.
    const result = computeSettlements([
      member("ana", 3000, 2000),
      member("bea", 0, 0),
    ]);
    expect(result).toEqual([
      {
        from: { id: "bea", name: "BEA" },
        to: { id: "ana", name: "ANA" },
        amountCents: 500,
      },
    ]);
  });

  it("en paz: sin transferencias", () => {
    const result = computeSettlements([
      member("ana", 2000, 1000),
      member("bea", 2000, 1000),
    ]);
    expect(result).toEqual([]);
  });

  it("los céntimos impares no descuadran la transferencia", () => {
    // 0,33 € entre dos: la deuda queda en 16 o 17 céntimos, nunca descuadrada.
    const result = computeSettlements([
      member("ana", 33, 0),
      member("bea", 0, 0),
    ]);
    expect(result).toHaveLength(1);
    expect([16, 17]).toContain(result[0].amountCents);
  });

  it("con tres personas el greedy casa deudores con acreedores", () => {
    // Ana pagó 90 €; Bea y Carla nada: cada una le debe 30 €.
    const result = computeSettlements([
      member("ana", 9000, 0),
      member("bea", 0, 0),
      member("carla", 0, 0),
    ]);
    expect(result).toHaveLength(2);
    for (const settlement of result) {
      expect(settlement.to.id).toBe("ana");
      expect(settlement.amountCents).toBe(3000);
    }
    expect(new Set(result.map((s) => s.from.id))).toEqual(
      new Set(["bea", "carla"]),
    );
  });
});
