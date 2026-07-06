import { describe, expect, it } from "vitest";
import { parseView, viewCookieName } from "./view";

describe("parseView", () => {
  it("acepta los modos válidos", () => {
    expect(parseView("grid")).toBe("grid");
    expect(parseView("list")).toBe("list");
  });

  it("cae al fallback con valores inválidos o ausentes", () => {
    expect(parseView(undefined)).toBe("grid");
    expect(parseView("foo")).toBe("grid");
    expect(parseView(undefined, "list")).toBe("list");
    expect(parseView("", "list")).toBe("list");
  });
});

describe("viewCookieName", () => {
  it("nombra la cookie por sección", () => {
    expect(viewCookieName("materiales")).toBe("view-materiales");
    expect(viewCookieName("pedidos")).toBe("view-pedidos");
  });
});
