import { describe, expect, it } from "vitest";
import { normalizeStandardizedPattern } from "./standardize-pattern.shared";

describe("normalizeStandardizedPattern", () => {
  it("deduplica abreviaturas repetidas y conserva la primera aparición", () => {
    const result = normalizeStandardizedPattern({
      title: "Patrón",
      language: "es",
      difficulty: null,
      hookSizeMm: null,
      materials: [],
      abbreviations: [
        { abbr: " pb ", meaning: "punto bajo" },
        { abbr: "PB", meaning: "punto bajo" },
        { abbr: "aum", meaning: "aumento" },
      ],
      sections: [],
      assemblyNotes: null,
    });

    expect(result.abbreviations).toEqual([
      { abbr: "pb", meaning: "punto bajo" },
      { abbr: "aum", meaning: "aumento" },
    ]);
  });

  it("mantiene el mismo contenido de rondas y deja preparada la compresión visual", () => {
    const result = normalizeStandardizedPattern({
      title: "Patrón",
      language: "es",
      difficulty: null,
      hookSizeMm: null,
      materials: [],
      abbreviations: [],
      sections: [
        {
          name: "Cuerpo",
          notes: null,
          rounds: [
            { label: "R1", instruction: "6 pb en anillo mágico", stitchCount: 6 },
            { label: "R2", instruction: "6 pb en anillo mágico", stitchCount: 6 },
            { label: "R3", instruction: "6 pb en anillo mágico", stitchCount: 6 },
            { label: "R4", instruction: "1 pb en cada punto", stitchCount: 12 },
          ],
        },
      ],
      assemblyNotes: null,
    });

    expect(result.sections[0]?.rounds).toHaveLength(4);
    expect(result.sections[0]?.rounds[0]).toMatchObject({
      label: "R1",
      instruction: "6 pb en anillo mágico",
      stitchCount: 6,
    });
  });
});
