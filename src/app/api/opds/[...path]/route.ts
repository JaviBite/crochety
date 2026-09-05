import type { Prisma } from "@/generated/prisma/client";
import { buildOpdsFeed, buildOpdsOsd } from "@/lib/opds";
import {
  authenticateOpds,
  loadOpdsBooks,
  opdsUnauthorized,
} from "@/lib/opds.server";
import { getWorkshopSettings } from "@/lib/settings";

// Secciones del catálogo OPDS (esquema Calibre-Web Automated):
//   GET /api/opds/patrones          — todos los patrones estandarizados
//   GET /api/opds/recopilatorios    — sólo los ficheros multi-patrón (MULTIPLE)
//   GET /api/opds/osd               — OpenSearchDescription (rel="search")
//   GET /api/opds/search?q=|query=  — búsqueda por título (también /search/<término>)
//   GET /api/opds/search/<término>  — plantilla atom rel="search" del feed
// Todas emiten feeds de adquisición con enlaces a la exportación EPUB/MD.

export const runtime = "nodejs";

function xmlResponse(xml: string, mime = "application/atom+xml; charset=utf-8"): Response {
  return new Response(xml, {
    headers: { "Content-Type": mime, "Cache-Control": "no-store" },
  });
}

async function sectionFeed(
  title: string,
  selfHref: string,
  where: Prisma.PatternWhereInput,
): Promise<Response> {
  const { workshopName, books } = await loadOpdsBooks(where);
  const updated = new Date().toISOString();
  return xmlResponse(
    buildOpdsFeed({
      kind: "acquisition",
      id: `urn:crochety:opds:${selfHref}`,
      title,
      selfHref,
      startHref: "/api/opds",
      updated,
      authorName: workshopName,
      searchHref: "/api/opds/search/{searchTerms}",
      books,
    }),
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const principal = await authenticateOpds(request);
  if (!principal) return opdsUnauthorized();

  const { path } = await params;
  const [first, second] = path;
  const url = new URL(request.url);
  const name = (await getWorkshopSettings()).name || "Crochety";

  switch (first) {
    case "patrones":
      return sectionFeed(`${name} · Todos los patrones`, "/api/opds/patrones", {
        standardizedContent: { not: null },
      });
    case "recopilatorios":
      return sectionFeed(`${name} · Recopilatorios`, "/api/opds/recopilatorios", {
        standardizedContent: { not: null },
        aiStatus: "MULTIPLE",
      });
    case "osd":
      return xmlResponse(
        buildOpdsOsd({
          shortName: `${name} · Patrones`,
          description: "Catálogo de patrones de crochet",
          template: "/api/opds/search?q={searchTerms}",
        }),
        "application/opensearchdescription+xml; charset=utf-8",
      );
    case "search": {
      const term = (
        second ??
        url.searchParams.get("q") ??
        url.searchParams.get("query") ??
        ""
      ).trim();
      if (!term) {
        return sectionFeed(`${name} · Todos los patrones`, "/api/opds/patrones", {
          standardizedContent: { not: null },
        });
      }
      return sectionFeed(
        `${name} · Búsqueda: ${term}`,
        `/api/opds/search?q=${encodeURIComponent(term)}`,
        {
          standardizedContent: { not: null },
          title: { contains: term, mode: "insensitive" },
        },
      );
    }
    default:
      return new Response("Sección OPDS no encontrada", { status: 404 });
  }
}
