import "server-only";

import bcrypt from "bcryptjs";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { EXT_TO_MIME } from "@/lib/files";
import {
  parseBasicAuth,
  buildOpdsFeed,
  type OpdsBookEntry,
} from "@/lib/opds";
import { parseStandardizedPatternsContent } from "@/lib/ai/standardize-pattern";
import { prisma } from "@/lib/prisma";
import { getWorkshopSettings } from "@/lib/settings";

// Autenticación y datos del catálogo OPDS. Las apps lectoras (Moon+ Reader,
// Crossink/Xteink, Kybook…) no comparten cookies de sesión: usan HTTP Basic.
// Se aceptan las dos vías — la sesión de la web o Basic contra la tabla User
// (mismo email y contraseña del login).

export type OpdsPrincipal = { userId: string };

/** 401 con el reto Basic para que el lector pida credenciales. */
export function opdsUnauthorized(): Response {
  return new Response("No autorizado", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Crochety OPDS", charset="UTF-8"',
    },
  });
}

/** Sesión de la web o HTTP Basic con las credenciales de un usuario real. */
export async function authenticateOpds(
  request: Request,
): Promise<OpdsPrincipal | null> {
  const session = await auth();
  if (session?.user) {
    return { userId: session.user.id };
  }

  const basic = parseBasicAuth(request.headers.get("authorization"));
  if (!basic) return null;

  const user = await prisma.user.findUnique({
    where: { email: basic.email },
    select: { id: true, passwordHash: true },
  });
  if (!user?.passwordHash) return null;
  if (!bcrypt.compareSync(basic.password, user.passwordHash)) return null;
  return { userId: user.id };
}

/**
 * Feed de adquisición OPDS listo para servir (XML + cabeceras): el raíz
 * `/api/opds` y las secciones/búsqueda lo usan. Autor = nombre del taller.
 */
export async function opdsAcquisitionFeed(
  title: string,
  selfHref: string,
  where: Prisma.PatternWhereInput,
): Promise<Response> {
  const { workshopName, books } = await loadOpdsBooks(where);
  const xml = buildOpdsFeed({
    kind: "acquisition",
    id: `urn:crochety:opds:${selfHref}`,
    title,
    selfHref,
    startHref: "/api/opds",
    updated: new Date().toISOString(),
    authorName: workshopName,
    searchHref: "/api/opds/search/{searchTerms}",
    books,
  });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

const OPDS_PATTERN_SELECT = {
  id: true,
  title: true,
  createdAt: true,
  standardizedContent: true,
  coverImagePath: true,
  tags: { select: { name: true }, orderBy: { name: "asc" as const } },
} as const;

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

/**
 * Libros del catálogo (patrones con versión estandarizada) según el filtro.
 * Cada entrada enlaza a la exportación EPUB/Markdown ya existente y lleva la
 * portada vía /api/files (imágenes públicas).
 */
export async function loadOpdsBooks(where: Prisma.PatternWhereInput): Promise<{
  workshopName: string;
  books: OpdsBookEntry[];
}> {
  const [workshop, patterns] = await Promise.all([
    getWorkshopSettings(),
    prisma.pattern.findMany({
      where,
      select: OPDS_PATTERN_SELECT,
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const authorName = workshop.name || "Crochety";

  const books = patterns.map((pattern) => {
    const parsed = parseStandardizedPatternsContent(
      pattern.standardizedContent ?? "",
    );
    const coverMime = pattern.coverImagePath
      ? (EXT_TO_MIME[
          pattern.coverImagePath.slice(pattern.coverImagePath.lastIndexOf("."))
        ] ?? null)
      : null;
    return {
      id: `urn:crochety:pattern:${pattern.id}`,
      title: pattern.title,
      updated: pattern.createdAt.toISOString(),
      author: authorName,
      language: parsed[0]?.language ?? null,
      categories: pattern.tags.map((tag) => tag.name),
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

  return { workshopName: authorName, books };
}
