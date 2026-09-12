import { describe, expect, it } from "vitest";
import { isOrderOverdue, resolveOrderCollectorId } from "./orders";

function daysAgo(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date;
}

function daysFromNow(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + n);
  return date;
}

describe("isOrderOverdue", () => {
  it("vencido con fecha pasada y no cobrado", () => {
    expect(isOrderOverdue({ dueDate: daysAgo(1), status: "EMPEZADO" })).toBe(true);
    expect(isOrderOverdue({ dueDate: daysAgo(30), status: "SIN_EMPEZAR" })).toBe(true);
  });

  it("no vencido con fecha futura o sin fecha", () => {
    expect(isOrderOverdue({ dueDate: daysFromNow(3), status: "EMPEZADO" })).toBe(false);
    expect(isOrderOverdue({ dueDate: null, status: "EMPEZADO" })).toBe(false);
  });

  it("los cobrados nunca están vencidos", () => {
    expect(isOrderOverdue({ dueDate: daysAgo(10), status: "COBRADO" })).toBe(false);
  });

  it("la fecha de hoy no cuenta como vencida (prorroga el día completo)", () => {
    const today = new Date();
    today.setHours(23, 59, 0, 0);
    expect(isOrderOverdue({ dueDate: today, status: "EMPEZADO" })).toBe(false);
  });
});

describe("resolveOrderCollectorId", () => {
  it("sin cobrador explícito lo cobra el asignado (pedidos ya existentes)", () => {
    expect(
      resolveOrderCollectorId({ collectedById: null, assignedToId: "ana" }),
    ).toBe("ana");
  });

  it("si se especificó otro cobrador, manda el cobrador", () => {
    expect(
      resolveOrderCollectorId({ collectedById: "bea", assignedToId: "ana" }),
    ).toBe("bea");
  });

  it("cobrador y asignado pueden coincidir o faltar los dos", () => {
    expect(
      resolveOrderCollectorId({ collectedById: "ana", assignedToId: "ana" }),
    ).toBe("ana");
    expect(
      resolveOrderCollectorId({ collectedById: null, assignedToId: null }),
    ).toBeNull();
  });
});
