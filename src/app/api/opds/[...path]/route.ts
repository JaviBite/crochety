import { buildOpdsOsd } from "@/lib/opds";
import {
  authenticateOpds,
  opdsAcquisitionFeed,
  opdsUnauthorized,
} from "@/lib/opds.server";
import { getWorkshopSettings } from "@/lib/settings";

// Rutas auxiliares del catálogo OPDS:
//   GET /api/opds/patrones         — alias del listado completo
//   GET /api/opds/osd              — OpenSearchDescription (rel="search")
//   GET /api/opds/search?q=|query= — búsqueda por título (también /search/<término>)
//   GET /api/opds/search/<término> — plantilla atom rel="search" del feed

export const runtime = "nodejs";

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
      return opdsAcquisitionFeed(`${name} · Todos los patrones`, "/api/opds/patrones", {
        standardizedContent: { not: null },
      });
    case "osd":
      return new Response(
        buildOpdsOsd({
          shortName: `${name} · Patrones`,
          description: "Catálogo de patrones de crochet",
          template: "/api/opds/search?q={searchTerms}",
        }),
        {
          headers: {
            "Content-Type":
              "application/opensearchdescription+xml; charset=utf-8",
            "Cache-Control": "no-store",
          },
        },
      );
    case "search": {
      const term = (
        second ??
        url.searchParams.get("q") ??
        url.searchParams.get("query") ??
        ""
      ).trim();
      if (!term) {
        return opdsAcquisitionFeed(
          `${name} · Todos los patrones`,
          "/api/opds/patrones",
          { standardizedContent: { not: null } },
        );
      }
      return opdsAcquisitionFeed(
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
