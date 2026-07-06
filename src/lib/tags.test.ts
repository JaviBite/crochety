import { describe, expect, it } from "vitest";
import {
  MAX_TAGS,
  parseTagNames,
  tagsCreateInput,
  tagsUpdateInput,
} from "./tags";

describe("parseTagNames", () => {
  it("normaliza a minúsculas, recorta y elimina duplicados", () => {
    expect(parseTagNames("Lana, Algodón , verde,verde")).toEqual([
      "lana",
      "algodón",
      "verde",
    ]);
  });

  it("descarta vacíos y espacios sueltos", () => {
    expect(parseTagNames("  , lana ,, ,")).toEqual(["lana"]);
  });

  it("devuelve [] para valores no-cadena o vacíos", () => {
    expect(parseTagNames(null)).toEqual([]);
    expect(parseTagNames("")).toEqual([]);
    expect(parseTagNames(new File([], "x"))).toEqual([]);
  });

  it("limita el número de tags", () => {
    const many = Array.from({ length: MAX_TAGS + 5 }, (_, i) => `t${i}`).join(",");
    expect(parseTagNames(many)).toHaveLength(MAX_TAGS);
  });
});

describe("tagsCreateInput / tagsUpdateInput", () => {
  it("crea connectOrCreate por cada nombre", () => {
    expect(tagsCreateInput(["lana", "verde"])).toEqual({
      connectOrCreate: [
        { where: { name: "lana" }, create: { name: "lana" } },
        { where: { name: "verde" }, create: { name: "verde" } },
      ],
    });
  });

  it("crea undefined cuando no hay tags (alta)", () => {
    expect(tagsCreateInput([])).toBeUndefined();
  });

  it("en update siempre limpia con set:[] y reconecta", () => {
    expect(tagsUpdateInput([])).toEqual({ set: [] });
    expect(tagsUpdateInput(["lana"])).toEqual({
      set: [],
      connectOrCreate: [{ where: { name: "lana" }, create: { name: "lana" } }],
    });
  });
});
