import { describe, expect, it } from "vitest";
import type { StandardizedPattern } from "@/lib/ai/standardize-pattern.shared";
import {
  slugifyFileName,
  toMarkdown,
  toMarkdownAll,
} from "./pattern-export";

function samplePattern(): StandardizedPattern {
  return {
    title: "Osito Bombero",
    language: "es",
    difficulty: "intermedio",
    hookSizeMm: 2.5,
    materials: ["Lana marrón", "Ojos de seguridad 8 mm"],
    abbreviations: [
      { abbr: "pb", meaning: "punto bajo" },
      { abbr: "aum", meaning: "aumento" },
    ],
    sections: [
      {
        name: "Cabeza",
        notes: "Trabaja en espiral",
        rounds: [
          { label: "R1", instruction: "6 pb en anillo mágico", stitchCount: 6 },
          { label: "R2", instruction: "aum x6", stitchCount: 12 },
          {
            label: "Paso 1",
            instruction: "Inserta los ojos de seguridad",
            stitchCount: null,
            kind: "step",
          },
          { label: "R3", instruction: "1 pb en cada punto", stitchCount: 12 },
          { label: "R4", instruction: "1 pb en cada punto", stitchCount: 12 },
        ],
      },
    ],
    assemblyNotes: "Cose las orejas antes de cerrar la cabeza.",
  };
}

describe("toMarkdown", () => {
  it("genera título, metadatos, materiales y abreviaturas", () => {
    const md = toMarkdown(samplePattern());
    expect(md).toContain("# Osito Bombero");
    expect(md).toContain("**Dificultad:** intermedio");
    expect(md).toContain("**Aguja:** 2.5 mm");
    expect(md).toContain("## Materiales");
    expect(md).toContain("- Lana marrón");
    expect(md).toContain("| pb | punto bajo |");
  });

  it("escribe rondas con su conteo y los pasos en cursiva", () => {
    const md = toMarkdown(samplePattern());
    expect(md).toContain("- **R1**: 6 pb en anillo mágico (6)");
    expect(md).toContain("- **R2**: aum x6 (12)");
    expect(md).toContain("- *Paso 1: Inserta los ojos de seguridad*");
    expect(md).toContain("## Cabeza");
    expect(md).toContain("> Trabaja en espiral");
    expect(md).toContain("## Montaje");
    expect(md).toContain("Cose las orejas");
  });
});

describe("toMarkdownAll", () => {
  it("concatena varios patrones separados por cortes", () => {
    const md = toMarkdownAll([samplePattern(), samplePattern()]);
    expect(md).toContain("---");
    expect(md.match(/# Osito Bombero/g)).toHaveLength(2);
  });
});

describe("slugifyFileName", () => {
  it("quita acentos, signos y espacios sobrantes", () => {
    expect(slugifyFileName("Patrón: Osito Bombero!")).toBe("patron-osito-bombero");
    expect(slugifyFileName("  Óso Ñoño  ")).toBe("oso-nono");
  });

  it("devuelve un nombre por defecto si no queda nada útil", () => {
    expect(slugifyFileName("???")).toBe("patron");
  });
});
