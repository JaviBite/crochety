// Utilidades puras del catálogo OPDS (sin dependencias de servidor): escape
// XML, parseo de HTTP Basic y construcción de feeds. Testeable sin BD.
// Estructura CALCADA de Calibre-Web Automated (la que consume Crossink en
// Xteink): feed raíz de navegación con secciones, feeds de adquisición con
// perfiles "opds-catalog" y OpenSearch (OSD + plantilla de búsqueda).

export type OpdsNavEntry = {
  id: string;
  title: string;
  updated: string;
  content: string;
  /** Feed hijo (acquisition) al que apunta el <link> de la sección. */
  href: string;
};

export type OpdsBookEntry = {
  /** Identificador único y estable de la publicación (urn:...). */
  id: string;
  title: string;
  /** Fecha de la publicación en ISO (usada en <updated>). */
  updated: string;
  author: string;
  /** Idioma ISO ("es"/"en") para dcterms:language, si se conoce. */
  language?: string | null;
  categories?: string[];
  summary: string;
  /** Portada opcional servida por /api/files (imágenes públicas). */
  coverHref?: string | null;
  coverMime?: string | null;
  /** Enlaces de adquisición (descarga directa del fichero). */
  acquisitions: { href: string; type: string }[];
};

export type OpdsFeed = {
  /** navigation = índice de secciones; acquisition = lista de libros. */
  kind: "navigation" | "acquisition";
  id: string;
  title: string;
  /** URL del propio feed (rel="self"). */
  selfHref: string;
  /** URL del feed raíz (rel="start"/"up"). */
  startHref: string;
  /** Fecha del feed en ISO. */
  updated: string;
  authorName: string;
  /** Plantilla de búsqueda con {searchTerms} (link rel="search" atom). */
  searchHref?: string | null;
  navigation?: OpdsNavEntry[];
  books?: OpdsBookEntry[];
};

const ATOM_PROFILE = "application/atom+xml;profile=opds-catalog";
const ATOM_NAV = `${ATOM_PROFILE};kind=navigation`;
// Quirk de Calibre-Web Automated: el feed de adquisición se autodeclara
// kind=navigation. Se copia EXACTO porque es lo que acepta Crossink.
const ATOM_FEED_QUIRK = `${ATOM_PROFILE};type=feed;kind=navigation`;

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

function searchLinks(searchHref?: string | null): string {
  if (!searchHref) return "";
  return `  <link rel="search" href="${xmlEscape(searchHref.replace("{searchTerms}", ""))}" type="application/opensearchdescription+xml"/>
  <link type="application/atom+xml" rel="search" title="Buscar" href="${xmlEscape(searchHref)}"/>
`;
}

export function buildOpdsFeed(feed: OpdsFeed): string {
  // El root de navegación va sin dc: (como CWA); el de adquisición los lleva.
  const rootNs =
    feed.kind === "acquisition"
      ? `<feed xmlns="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/terms/" xmlns:dcterms="http://purl.org/dc/terms/">`
      : `<feed xmlns="http://www.w3.org/2005/Atom">`;
  const selfType = feed.kind === "navigation" ? ATOM_NAV : ATOM_FEED_QUIRK;

  const navigation = (feed.navigation ?? [])
    .map(
      (entry) => `  <entry>
    <title>${xmlEscape(entry.title)}</title>
    <link href="${xmlEscape(entry.href)}" type="${ATOM_PROFILE}"/>
    <id>${xmlEscape(entry.id)}</id>
    <updated>${xmlEscape(entry.updated)}</updated>
    <content type="text">${xmlEscape(entry.content)}</content>
  </entry>`,
    )
    .join("\n");

  const books = (feed.books ?? [])
    .map((entry) => {
      const language = entry.language
        ? `    <dcterms:language>${xmlEscape(entry.language)}</dcterms:language>\n`
        : "";
      const categories = (entry.categories ?? [])
        .map(
          (tag) =>
            `    <category scheme="urn:crochety:tags" term="${xmlEscape(tag)}" label="${xmlEscape(tag)}"/>`,
        )
        .join("\n");
      const cover = entry.coverHref
        ? `    <link type="${xmlEscape(entry.coverMime ?? "image/jpeg")}" href="${xmlEscape(entry.coverHref)}" rel="http://opds-spec.org/image"/>
    <link type="${xmlEscape(entry.coverMime ?? "image/jpeg")}" href="${xmlEscape(entry.coverHref)}" rel="http://opds-spec.org/image/thumbnail"/>
`
        : "";
      const acquisitions = entry.acquisitions
        .map(
          (a) =>
            `    <link rel="http://opds-spec.org/acquisition" href="${xmlEscape(a.href)}" type="${xmlEscape(a.type)}"/>`,
        )
        .join("\n");
      return `  <entry>
    <title>${xmlEscape(entry.title)}</title>
    <id>${xmlEscape(entry.id)}</id>
    <updated>${xmlEscape(entry.updated)}</updated>
    <author>
      <name>${xmlEscape(entry.author)}</name>
    </author>
${language}${categories}
    <summary>${xmlEscape(entry.summary)}</summary>
${cover}${acquisitions}
  </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
${rootNs}
  <id>${xmlEscape(feed.id)}</id>
  <updated>${xmlEscape(feed.updated)}</updated>
  <link rel="self" href="${xmlEscape(feed.selfHref)}" type="${selfType}"/>
  <link rel="start" href="${xmlEscape(feed.startHref)}" type="${ATOM_NAV}"/>
${feed.kind === "acquisition" && feed.selfHref !== feed.startHref ? `  <link rel="up" href="${xmlEscape(feed.startHref)}" type="${ATOM_NAV}"/>\n` : ""}${searchLinks(feed.searchHref)}  <title>${xmlEscape(feed.title)}</title>
  <author>
    <name>${xmlEscape(feed.authorName)}</name>
  </author>

${navigation}${books}
</feed>`;
}

/** OpenSearchDescription (rel="search"), como el /opds/osd de Calibre-Web. */
export function buildOpdsOsd(input: {
  shortName: string;
  description: string;
  /** Plantilla atom, con {searchTerms} literal. */
  template: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
   <LongName>${xmlEscape(input.shortName)}</LongName>
   <ShortName>${xmlEscape(input.shortName)}</ShortName>
   <Description>${xmlEscape(input.description)}</Description>
   <Url type="application/atom+xml"
        template="${xmlEscape(input.template)}"/>
   <SyndicationRight>open</SyndicationRight>
   <Language>*</Language>
   <OutputEncoding>UTF-8</OutputEncoding>
   <InputEncoding>UTF-8</InputEncoding>
</OpenSearchDescription>
`;
}
