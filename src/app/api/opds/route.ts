import { authenticateOpds, opdsAcquisitionFeed, opdsUnauthorized } from "@/lib/opds.server";
import { getWorkshopSettings } from "@/lib/settings";

// GET /api/opds — catálogo OPDS directo: la lista de patrones estandarizados
// como feed de adquisición (esquema Calibre-Web Automated, el que consume
// Crossink en Xteink). Sin navegación ni secciones: entradas + búsqueda.

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const principal = await authenticateOpds(request);
  if (!principal) return opdsUnauthorized();

  const name = (await getWorkshopSettings()).name || "Crochety";
  return opdsAcquisitionFeed(`${name} · Patrones`, "/api/opds", {
    standardizedContent: { not: null },
  });
}
