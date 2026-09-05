import { describe, expect, it } from "vitest";
import {
  MAX_PATTERNS_PER_CALL,
  dedupeIdenticalPatterns,
  looksLikeDuplicateSplit,
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

describe("dedupeIdenticalPatterns", () => {
  function patternWithRounds(title: string, round: string): StandardizedPattern {
    return basePattern({
      title,
      sections: [{ name: "Cuerpo", notes: null, rounds: [{ label: "R1", instruction: round, stitchCount: 6, kind: undefined }] }],
    });
  }

  it("elimina copias exactas (mismo título y mismas rondas)", () => {
    const duplicated = [
      patternWithRounds("Calabaza", "6 pb en anillo mágico"),
      patternWithRounds("Calabaza", "6 pb en anillo mágico"),
    ];
    expect(dedupeIdenticalPatterns(duplicated)).toHaveLength(1);
  });

  it("conserva variantes con igual título pero contenido distinto", () => {
    const variants = [
      patternWithRounds("Gorra", "6 pb en anillo mágico"),
      patternWithRounds("Gorra", "8 pb en anillo mágico"),
    ];
    expect(dedupeIdenticalPatterns(variants)).toHaveLength(2);
  });

  it("ignora paréntesis y mayúsculas al comparar títulos", () => {
    const duplicated = [
      patternWithRounds("Calabaza (Mediana)", "6 pb en anillo mágico"),
      patternWithRounds("calabaza", "6 pb en anillo mágico"),
    ];
    expect(dedupeIdenticalPatterns(duplicated)).toHaveLength(1);
  });
});

describe("looksLikeDuplicateSplit", () => {
  function titled(title: string): StandardizedPattern {
    return basePattern({ title });
  }

  it("detecta N≥3 patrones con un solo título distinto (split inventado)", () => {
    const fake = [titled("Calabaza"), titled("Calabaza (2)"), titled("Calabaza")];
    expect(looksLikeDuplicateSplit(fake)).toBe(true);
  });

  it("no se activa con dos patrones o títulos variados (recopilatorio real)", () => {
    expect(looksLikeDuplicateSplit([titled("A"), titled("A")])).toBe(false);
    expect(
      looksLikeDuplicateSplit([titled("Calabaza"), titled("Fantasma"), titled("Gato")]),
    ).toBe(false);
  });
});
