// Prueba e2e del backend del Pattern Parser con los patrones reales de /patterns.
// Uso: npx tsx --conditions=react-server scratchpad/pattern-parser-e2e.ts <caso>
//   casos: mini (PDF texto) · halloween (PDF multi) · img (visión) · web (scrape)
// Sin <caso> ejecuta todos. Sube los ficheros al storage real (Blob), ejecuta el
// pipeline completo (extracción → IA → contrato) y limpia los uploads.

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });

// Modelo con visión configurable por CLI para la prueba de imágenes
// (--model=id): solo afecta a este proceso (BD > env > default en settings).
const modelArg = process.argv.find((arg) => arg.startsWith("--model="));
if (modelArg) process.env.AI_MODEL = modelArg.slice("--model=".length);

// Imports dinámicos DESPUÉS del env: los módulos de la app leen process.env
// al inicializarse (prisma/adapter, settings) y los import estáticos se izan.
const { readFileSync } = await import("node:fs");
const path = await import("node:path");
const {
  extractPatternContent,
  looksLikePatternText,
} = await import("../src/lib/pattern-source");
const { parseStandardizedPatternsContent } = await import(
  "../src/lib/ai/standardize-pattern"
);
const { standardizePatternSource } = await import(
  "../src/lib/ai/standardize-source"
);
const { deleteUpload, saveUpload } = await import("../src/lib/files.server");
const { getAiConfig } = await import("../src/lib/settings");

import type { PatternSource } from "@/lib/pattern-source";
import type { StandardizedPattern } from "@/lib/ai/standardize-pattern";

const PATTERNS_DIR = path.resolve("patterns");

function log(label: string, ...args: unknown[]) {
  console.log(`[${label}]`, ...args);
}

function summarize(label: string, patterns: StandardizedPattern[]) {
  for (const [i, pattern] of patterns.entries()) {
    const rounds = pattern.sections.reduce(
      (sum, s) => sum + s.rounds.length,
      0,
    );
    const steps = pattern.sections.reduce(
      (sum, s) => sum + s.rounds.filter((r) => r.kind === "step").length,
      0,
    );
    log(
      label,
      `#${i + 1} "${pattern.title}" · secciones=${pattern.sections.length} `
        + `rondas=${rounds} pasos=${steps} materiales=${pattern.materials.length} `
        + `abbr=${pattern.abbreviations.length} dificultad=${pattern.difficulty ?? "-"} `
        + `aguja=${pattern.hookSizeMm ?? "-"}`,
    );
    const first = pattern.sections[0]?.rounds[0];
    if (first) {
      log(label, `    muestra: ${first.label}: ${first.instruction.slice(0, 70)}`);
    }
  }
  // Todo resultado debe revalidar contra el contrato.
  const revalidated = parseStandardizedPatternsContent(
    JSON.stringify(patterns.length === 1 ? patterns[0] : patterns),
  );
  log(
    label,
    `contrato: OK (${revalidated.length} patrón(es) revalidados)`,
  );
}

async function runCase(label: string, source: PatternSource, uploads: string[]) {
  try {
    const content = await extractPatternContent(source);
    log(label, `contenido extraído: ${content.type}`);
    if (content.type === "text") {
      log(
        label,
        `heurística: parece patrón=${looksLikePatternText(content.text)} · chars=${content.text.length}`,
      );
    } else {
      log(label, `imágenes para visión: ${content.images.length}`);
    }
    const t0 = Date.now();
    // Pipeline completo (texto → visión con reintento), igual que producción.
    const patterns = await standardizePatternSource(source);
    log(
      label,
      `IA: ${patterns.length} patrón(es) en ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
    if (patterns.length === 0) {
      log(label, "SIN PATRONES DETECTADOS");
      return;
    }
    summarize(label, patterns);
  } catch (error) {
    console.error(`[${label}] ERROR:`, error instanceof Error ? error.message : error);
  } finally {
    for (const upload of uploads) await deleteUpload(upload).catch(() => {});
  }
}

async function saveFromDisk(relPath: string, mime: string): Promise<string> {
  const bytes = readFileSync(path.join(PATTERNS_DIR, relPath));
  const file = new File([bytes as BlobPart], path.basename(relPath), { type: mime });
  return saveUpload("patterns", file);
}

async function casePdf(relPath: string, label: string) {
  const saved = await saveFromDisk(relPath, "application/pdf");
  log(label, `upload: ${saved}`);
  await runCase(
    label,
    { filePath: saved, externalUrl: null, imagePaths: [] },
    [saved],
  );
}

async function caseImages(relPaths: string[], label: string) {
  const saved: string[] = [];
  for (const relPath of relPaths) {
    saved.push(await saveFromDisk(relPath, "image/png"));
  }
  log(label, `uploads: ${saved.join(", ")}`);
  await runCase(label, { filePath: null, externalUrl: null, imagePaths: saved }, saved);
}

async function caseWeb(url: string, label: string) {
  await runCase(label, { filePath: null, externalUrl: url, imagePaths: [] }, []);
}

async function main() {
  const config = await getAiConfig();
  log(
    "IA",
    `provider=${config.provider} model=${config.modelId || "(default del proveedor)"}`,
  );

  const only =
    process.argv[2] && !process.argv[2].startsWith("--")
      ? process.argv[2]
      : undefined;

  if (!only || only === "mini") {
    await casePdf("MiniBeerPattern.pdf", "mini");
  }
  if (!only || only === "loki") {
    await casePdf("LOKIFunSizePattern-1.pdf", "loki");
  }
  if (!only || only === "cat") {
    await casePdf("cat in pumpkin crochet pattern.pdf", "cat");
  }
  if (!only || only === "halloween") {
    await casePdf("Halloween recopilation.pdf", "halloween");
  }
  if (!only || only === "img") {
    await caseImages(
      ["image_mushroom_part1.png", "image_mushroom_part2.png"],
      "img",
    );
  }
  if (!only || only === "web") {
    const url =
      process.argv.find((arg) => arg.startsWith("--url="))?.slice(6) ??
      readFileSync(path.join(PATTERNS_DIR, "link_web_pattern.txt"), "utf8").trim();
    await caseWeb(url, "web");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("FATAL:", error);
    process.exit(1);
  });
