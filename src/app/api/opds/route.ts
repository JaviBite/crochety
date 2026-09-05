import { buildOpdsFeed } from "@/lib/opds";
import { authenticateOpds, opdsUnauthorized } from "@/lib/opds.server";
import { getWorkshopSettings } from "@/lib/settings";

// GET /api/opds — feed raíz de navegación (esquema Calibre-Web Automated,
// el que consumen los lectores e-ink tipo Xteink/Crossink). Las secciones
// apuntan a los feeds de adquisición bajo /api/opds/[...path].

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const principal = await authenticateOpds(request);
  if (!principal) return opdsUnauthorized();

  const workshop = await getWorkshopSettings();
  const name = workshop.name || "Crochety";
  const updated = new Date().toISOString();

  const xml = buildOpdsFeed({
    kind: "navigation",
    id: "urn:crochety:opds:root",
    title: `${name} · Patrones`,
    selfHref: "/api/opds",
    startHref: "/api/opds",
    updated,
    authorName: name,
    searchHref: "/api/opds/search/{searchTerms}",
    navigation: [
      {
        id: "/api/opds/patrones",
        title: "Todos los patrones",
        href: "/api/opds/patrones",
        updated,
        content: "Patrones estandarizados",
      },
      {
        id: "/api/opds/recopilatorios",
        title: "Recopilatorios",
        href: "/api/opds/recopilatorios",
        updated,
        content: "Ficheros con varios patrones",
      },
    ],
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
