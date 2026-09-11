import { config as loadEnv } from "dotenv";

// ---------------------------------------------------------------------------
// Batería de pruebas del estandarizador con patrones REALES de la BD (dry-run:
// no escribe nada — solo extrae, llama al LLM y clasifica el resultado).
//
//   npx tsx prisma/standardize-battery.ts            → los últimos N (default 6)
//   npx tsx prisma/standardize-battery.ts --id <id>  → un patrón concreto
//   npx tsx prisma/standardize-battery.ts --limit 4 --dump
//
// Prioriza los ERROR (los que "devuelven vacío") y mezcla DONE como regresión.
// Replica el pipeline real de standardize-source.ts (extraer → LLM →
// reintento por visión en PDFs) sin el import "server-only", y carga el .env
// ANTES de importar los módulos de lib (el singleton de Prisma lee la URL al
// cargarse el módulo: si el .env no está ya, falla setting.findMany).
// ---------------------------------------------------------------------------

loadEnv({ path: [".env.development.local", ".env"] });

import type { StandardizedPattern } from "../src/lib/ai/standardize-pattern.shared";
import type { PatternSource } from "../src/lib/pattern-source";

const DUMP = process.argv.includes("--dump");
const idIndex = process.argv.indexOf("--id");
const limitIndex = process.argv.indexOf("--limit");
const argId = idIndex >= 0 ? process.argv[idIndex + 1] : undefined;
const LIMIT = Number(
  limitIndex >= 0 ? process.argv[limitIndex + 1] : 6,
);

type PatternRow = {
  id: string;
  title: string;
  aiStatus: string;
  filePath: string | null;
  externalUrl: string | null;
  imagePaths: string | null;
};

type Outcome = "OK" | "MULTI" | "EMPTY";

function classify(patterns: StandardizedPattern[]): Outcome {
  if (patterns.length === 0) return "EMPTY";
  return patterns.length === 1 ? "OK" : "MULTI";
}

const ICON: Record<Outcome, string> = { OK: "✅", MULTI: "🧩", EMPTY: "❌" };

async function main() {
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { looksLikeDuplicateSplit } = await import(
    "../src/lib/ai/standardize-pattern.shared"
  );
  const { standardizePattern, standardizePatternFromImages } = await import(
    "../src/lib/ai/standardize-pattern"
  );
  const { extractPatternContent, parseImagePaths, rasterizePdfPages } =
    await import("../src/lib/pattern-source");

  // Cliente propio del script (el .env ya está cargado).
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString:
        process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
    }),
  });

  function toSource(pattern: PatternRow): PatternSource {
    return {
      filePath: pattern.filePath,
      externalUrl: pattern.externalUrl,
      imagePaths: parseImagePaths(pattern.imagePaths),
    };
  }

  /** Réplica del pipeline de standardize-source.ts (sin "server-only"). */
  async function runPipeline(
    source: PatternSource,
    log: (s: string) => void,
  ): Promise<{
    patterns: StandardizedPattern[];
    kind: string;
    size: string;
    visionRetry: boolean;
  }> {
    const content = await extractPatternContent(source);
    const kind = content.type === "images" ? "imágenes" : "texto";
    const size =
      content.type === "images"
        ? `${content.images.length} img`
        : `${content.text.length} chars`;

    let patterns =
      content.type === "images"
        ? await standardizePatternFromImages(content.images)
        : await standardizePattern(content.text, (event) => {
            log(
              event.type === "segment"
                ? `segmento ${event.index}/${event.total}`
                : event.type,
            );
          });

    // Mismo guardia del pipeline: PDF cuyo texto "parecía" un patrón y el LLM
    // no encontró nada → reintento por visión con las páginas rasterizadas.
    let visionRetry = false;
    if (patterns.length === 0 && source.filePath?.endsWith(".pdf")) {
      visionRetry = true;
      log("reintento por visión (rasterizando PDF)");
      const images = await rasterizePdfPages(source.filePath).catch(() => []);
      if (images.length > 0) {
        log(`${images.length} páginas a visión`);
        patterns = await standardizePatternFromImages(images);
      }
    }

    return { patterns, kind, size, visionRetry };
  }

  try {
    const patterns = await prisma.pattern.findMany({
      where: argId
        ? { id: argId }
        : {
            OR: [
              { filePath: { not: null } },
              { externalUrl: { not: null } },
              { imagePaths: { not: null } },
            ],
          },
      orderBy: [{ aiStatus: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        aiStatus: true,
        filePath: true,
        externalUrl: true,
        imagePaths: true,
      },
      take: Number.isFinite(LIMIT) && LIMIT > 0 ? LIMIT : 6,
    });
    if (patterns.length === 0) {
      console.log("No hay patrones con origen en la BD (o el --id no existe).");
      return;
    }

    console.log(
      `Batería: ${patterns.length} patrón(es) — dry-run, no escribe en la BD.\n`,
    );
    if (DUMP) mkdirSync(".opencode/battery", { recursive: true });

    const summary: string[] = [];
    for (const pattern of patterns) {
      console.log(`[${pattern.aiStatus}] ${pattern.title}`);
      console.log(
        `   origen: ${pattern.filePath ?? pattern.externalUrl ?? "(imágenes)"}`,
      );
      const log = (s: string) => console.log(`   · ${s}`);
      const started = performance.now();
      try {
        const result = await runPipeline(toSource(pattern), log);
        const seconds = ((performance.now() - started) / 1000).toFixed(1);
        const outcome = classify(result.patterns);
        const dup = looksLikeDuplicateSplit(result.patterns);
        const titles =
          result.patterns.map((p) => p.title).join(" | ") || "(ninguno)";
        const fases = result.visionRetry
          ? "2 fases (texto+visión)"
          : `1 fase (${result.kind}: ${result.size})`;
        console.log(`   → ${ICON[outcome]} ${outcome} en ${seconds}s · ${fases}`);
        console.log(
          `   → patrones: ${titles}${dup ? " · ¡SPLIT con mismo título!" : ""}`,
        );
        summary.push(`${ICON[outcome]} ${outcome} [${pattern.aiStatus}] ${pattern.title}`);
        if (DUMP) {
          writeFileSync(
            `.opencode/battery/${pattern.id}.json`,
            JSON.stringify(result.patterns, null, 2),
          );
        }
      } catch (error) {
        const seconds = ((performance.now() - started) / 1000).toFixed(1);
        const message = error instanceof Error ? error.message : String(error);
        console.log(`   → 💥 ERROR en ${seconds}s: ${message.slice(0, 2000)}`);
        summary.push(
          `💥 ERROR [${pattern.aiStatus}] ${pattern.title}: ${message.slice(0, 200)}`,
        );
      }
      console.log("");
    }

    console.log("— Resumen —");
    for (const line of summary) console.log(line);
    const ok = summary.filter((line) => line.includes("✅")).length;
    const multi = summary.filter((line) => line.includes("🧩")).length;
    const empty = summary.filter((line) => line.includes("❌")).length;
    const failed = summary.filter((line) => line.includes("💥")).length;
    console.log(
      `total: ${ok} OK · ${multi} multi · ${empty} vacío · ${failed} error (de ${patterns.length})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
