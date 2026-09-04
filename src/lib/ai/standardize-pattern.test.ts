import { describe, expect, it } from "vitest";
import {
  MAX_PATTERNS_PER_CALL,
  normalizeStandardizedPattern,
  normalizeStandardizedPatterns,
  parseStandardizedPatternsContent,
  type StandardizedPattern,
} from "./standardize-pattern.shared";

function basePattern(overrides: Partial<StandardizedPattern> = {}): StandardizedPattern {
  return {
    title: "Patrón",
    language: "es",
    difficulty: null,
    hookSizeMm: null,
    materials: [],
    abbreviations: [],
    sections: [],
    assemblyNotes: null,
    ...overrides,
  };
}

function roundPattern(index: number): StandardizedPattern {
  return basePattern({
    title: `Patrón ${index}`,
    sections: [
      {
        name: "Cuerpo",
        notes: null,
        rounds: [
          {
            label: "R1",
            instruction: "6 pb en anillo mágico",
            stitchCount: 6,
          },
        ],
      },
    ],
  });
}

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

  it("conserva kind: step en las instrucciones intercaladas y lo limpia en rondas", () => {
    const result = normalizeStandardizedPattern({
      title: "Patrón",
      language: "es",
      difficulty: null,
      hookSizeMm: null,
      materials: [],
      abbreviations: [],
      sections: [
        {
          name: "Cabeza",
          notes: null,
          rounds: [
            {
              label: "R1",
              instruction: "6 pb en anillo mágico",
              stitchCount: 6,
              kind: "round",
            },
            {
              label: "Paso 1",
              instruction: "Inserta los ojos de seguridad",
              stitchCount: null,
              kind: "step",
            },
          ],
        },
      ],
      assemblyNotes: null,
    });

    expect(result.sections[0]?.rounds[0]?.kind).toBeUndefined();
    expect(result.sections[0]?.rounds[1]?.kind).toBe("step");
  });
});

describe("normalizeStandardizedPatterns", () => {
  it("descarta los patrones sin contenido (ruido del LLM)", () => {
    const result = normalizeStandardizedPatterns([
      basePattern({ title: "Vacio" }),
      basePattern({ title: "Solo título" }),
      roundPattern(1),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Patrón 1");
  });

  it("aplica el tope de patrones por llamada", () => {
    const many = Array.from({ length: MAX_PATTERNS_PER_CALL + 5 }, (_, i) =>
      roundPattern(i),
    );
    expect(normalizeStandardizedPatterns(many)).toHaveLength(MAX_PATTERNS_PER_CALL);
  });
});

describe("parseStandardizedPatternsContent", () => {
  it("lee el formato multi-patrón { patterns: [...] }", () => {
    const raw = JSON.stringify({ patterns: [roundPattern(1), roundPattern(2)] });
    const result = parseStandardizedPatternsContent(raw);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.title)).toEqual(["Patrón 1", "Patrón 2"]);
  });

  it("lee un array plano de patrones", () => {
    const raw = JSON.stringify([roundPattern(1)]);
    expect(parseStandardizedPatternsContent(raw)).toHaveLength(1);
  });

  it("envuelve un patrón único en formato legado", () => {
    const raw = JSON.stringify(roundPattern(1));
    const result = parseStandardizedPatternsContent(raw);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Patrón 1");
  });

  it("descarta los items inválidos de un array mixto", () => {
    const raw = JSON.stringify([roundPattern(1), { foo: "bar" }, null]);
    const result = parseStandardizedPatternsContent(raw);
    expect(result).toHaveLength(1);
  });

  it("devuelve [] para JSON corrupto o nulo", () => {
    expect(parseStandardizedPatternsContent(null)).toEqual([]);
    expect(parseStandardizedPatternsContent("{no-json")).toEqual([]);
    expect(parseStandardizedPatternsContent("42")).toEqual([]);
  });
});
