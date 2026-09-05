import { getWorkshopSettings } from "@/lib/settings";
import { EXT_TO_MIME } from "@/lib/files";
import {
  buildOpdsFeed,
  type OpdsEntry,
  type OpdsFeed,
} from "@/lib/opds";
import { authenticateOpds, opdsUnauthorized } from "@/lib/opds.server";
import {
  parseStandardizedPatternsContent,
} from "@/lib/ai/standardize-pattern";
import { prisma } from "@/lib/prisma";

// GET /api/opds — catálogo OPDS de los patrones estandarizados.
// Los lectores de ebooks (Moon+ Reader, Kybook, ReadEra…) lo consumen con
// HTTP Basic (email y contraseña del login); con sesión de la web también va.
// Cada entrada enlaza a la exportación EPUB/Markdown ya existente:
//   /api/patterns/[id]/export?format=epub|md
// La portada es la imagen del patrón vía /api/files (imágenes públicas).

export const runtime = "nodejs";

const PAGE_SIZE = 50;

/** Resumen con secciones y rondas del contenido estandarizado. */
function summaryOf(raw: string): string {
  const patterns = parseStandardizedPatternsContent(raw);
  if (patterns.length === 0) return "Patrón estandarizado";
  let sections = 0;
  let rounds = 0;
  for (const pattern of patterns) {
    sections += pattern.sections.length;
    for (const section of pattern.sections) rounds += section.rounds.length;
  }
  const plural = patterns.length > 1 ? `${patterns.length} patrones · ` : "";
  return `${plural}${sections} ${sections === 1 ? "sección" : "secciones"} · ${rounds} ${rounds === 1 ? "ronda" : "rondas"}`;
}

export async function GET(request: Request): Promise<Response> {
  const principal = await authenticateOpds(request);
  if (!principal) return opdsUnauthorized();

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  const [workshop, total] = await Promise.all([
    getWorkshopSettings(),
    prisma.pattern.count({
      where: { standardizedContent: { not: null } },
    }),
  ]);

  const patterns = await prisma.pattern.findMany({
    where: { standardizedContent: { not: null } },
    select: {
      id: true,
      title: true,
      createdAt: true,
      standardizedContent: true,
      coverImagePath: true,
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const entries: OpdsEntry[] = patterns.map((pattern) => {
    const coverMime = pattern.coverImagePath
      ? (EXT_TO_MIME[
          pattern.coverImagePath.slice(pattern.coverImagePath.lastIndexOf("."))
        ] ?? null)
      : null;
    return {
      id: `urn:crochety:pattern:${pattern.id}`,
      title: pattern.title,
      updated: pattern.createdAt.toISOString(),
      summary: summaryOf(pattern.standardizedContent ?? ""),
      coverHref: pattern.coverImagePath
        ? `/api/files/${pattern.coverImagePath}`
        : null,
      coverMime,
      acquisitions: [
        {
          href: `/api/patterns/${pattern.id}/export?format=epub`,
          type: "application/epub+zip",
        },
        {
          href: `/api/patterns/${pattern.id}/export?format=md`,
          type: "text/markdown; charset=utf-8",
        },
      ],
    };
  });

  const hasNext = page * PAGE_SIZE < total;
  const selfHref = page > 1 ? `/api/opds?page=${page}` : "/api/opds";
  const feed: OpdsFeed = {
    id: "urn:crochety:opds:patterns",
    title: `${workshop.name || "Crochety"} · Patrones`,
    selfHref,
    updated: new Date().toISOString(),
    entries,
    nextHref: hasNext ? `/api/opds?page=${page + 1}` : null,
  };

  return new Response(buildOpdsFeed(feed), {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
