// Tests del generador EPUB (server-only: vitest lo resuelve con el alias a
// server-only/empty definido en vitest.config.ts).
import { describe, expect, it } from "vitest";
import type { StandardizedPattern } from "@/lib/ai/standardize-pattern.shared";
import { toEpub } from "./pattern-export.server";

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
          {
            label: "Paso 1",
            instruction: "Inserta los ojos de seguridad",
            stitchCount: null,
            kind: "step",
          },
        ],
      },
    ],
    assemblyNotes: "Cose las orejas antes de cerrar la cabeza.",
  };
}

describe("toEpub", () => {
  // La generación EPUB en el suite completo puede ir lenta en máquinas
  // lentas: timeout explícito para evitar flakes.
  it("genera un EPUB válido (zip) en memoria", { timeout: 20_000 }, async () => {
    const epub = await toEpub(samplePattern());
    expect(epub.byteLength).toBeGreaterThan(1000);
    // Todo EPUB es un ZIP: firma "PK".
    expect(epub[0]).toBe(0x50);
    expect(epub[1]).toBe(0x4b);
  });

  it("acepta portada opcional", { timeout: 20_000 }, async () => {
    const cover = new File([new Uint8Array([1, 2, 3])], "cover.jpg", {
      type: "image/jpeg",
    });
    const epub = await toEpub(samplePattern(), cover);
    expect(epub[0]).toBe(0x50);
  });
});
