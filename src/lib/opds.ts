// Utilidades puras del catálogo OPDS (sin dependencias de servidor): escape
// XML, parseo de HTTP Basic y construcción del feed Atom. Testeables sin BD.

export type OpdsEntry = {
  /** Identificador único y estable de la publicación (urn:...). */
  id: string;
  title: string;
  /** Fecha de la publicación en ISO (usada en <updated>). */
  updated: string;
  summary: string;
  /** Portada opcional servida por /api/files (imágenes públicas). */
  coverHref?: string | null;
  coverMime?: string | null;
  /** Enlaces de adquisición (descarga directa del fichero). */
  acquisitions: { href: string; type: string }[];
};

export type OpdsFeed = {
  id: string;
  title: string;
  /** URL del propio feed (rel="self"). */
  selfHref: string;
  /** Fecha del feed en ISO. */
  updated: string;
  entries: OpdsEntry[];
  /** Siguiente página, si la hay (?page=N). */
  nextHref?: string | null;
};

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Cabecera "Authorization: Basic base64(email:password)" → credenciales. */
export function parseBasicAuth(
  header: string | null,
): { email: string; password: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  const encoded = header.slice("Basic ".length).trim();
  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return null;
  }
  // La contraseña puede contener ":" — solo se separa en el primero.
  const colon = decoded.indexOf(":");
  if (colon < 0) return null;
  const email = decoded.slice(0, colon).trim();
  const password = decoded.slice(colon + 1);
  if (!email || !password) return null;
  return { email, password };
}

export function buildOpdsFeed(feed: OpdsFeed): string {
  const entries = feed.entries
    .map((entry) => {
      const cover = entry.coverHref
        ? `    <link rel="http://opds-spec.org/image/thumbnail" href="${xmlEscape(entry.coverHref)}" type="${xmlEscape(entry.coverMime ?? "image/jpeg")}"/>\n`
        : "";
      const acquisitions = entry.acquisitions
        .map(
          (a) =>
            `    <link rel="http://opds-spec.org/acquisition" href="${xmlEscape(a.href)}" type="${xmlEscape(a.type)}"/>`,
        )
        .join("\n");
      return `  <entry>
    <id>${xmlEscape(entry.id)}</id>
    <title>${xmlEscape(entry.title)}</title>
    <updated>${xmlEscape(entry.updated)}</updated>
    <summary>${xmlEscape(entry.summary)}</summary>
${cover}${acquisitions}
  </entry>`;
    })
    .join("\n");

  const next = feed.nextHref
    ? `  <link rel="next" href="${xmlEscape(feed.nextHref)}"/>\n`
    : "";

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${xmlEscape(feed.id)}</id>
  <title>${xmlEscape(feed.title)}</title>
  <updated>${xmlEscape(feed.updated)}</updated>
  <author><name>Crochety</name></author>
  <link rel="self" href="${xmlEscape(feed.selfHref)}"/>
${next}${entries}
</feed>`;
}
