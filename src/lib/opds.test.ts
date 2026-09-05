import { describe, expect, it } from "vitest";
import {
  buildOpdsFeed,
  buildOpdsOsd,
  parseBasicAuth,
  xmlEscape,
} from "./opds";

describe("xmlEscape", () => {
  it("escapa los caracteres reservados de XML", () => {
    expect(xmlEscape(`a<b&c>"d'`)).toBe("a&lt;b&amp;c&gt;&quot;d'");
  });
});

describe("parseBasicAuth", () => {
  it("parsea credenciales válidas", () => {
    const header = `Basic ${Buffer.from("ana@taller.es:secreto", "utf8").toString("base64")}`;
    expect(parseBasicAuth(header)).toEqual({
      email: "ana@taller.es",
      password: "secreto",
    });
  });

  it("conserva los ':' de la contraseña (solo separa en el primero)", () => {
    const header = `Basic ${Buffer.from("ana@taller.es:pa:ss:word", "utf8").toString("base64")}`;
    expect(parseBasicAuth(header)?.password).toBe("pa:ss:word");
  });

  it("rechaza cabeceras que no son Basic, vacías o corruptas", () => {
    expect(parseBasicAuth(null)).toBeNull();
    expect(parseBasicAuth("Bearer abc")).toBeNull();
    expect(parseBasicAuth("Basic !!!no-base64!!!")).toBeNull();
    expect(parseBasicAuth(`Basic ${Buffer.from("sin-dos-puntos", "utf8").toString("base64")}`)).toBeNull();
    expect(parseBasicAuth(`Basic ${Buffer.from(":clave", "utf8").toString("base64")}`)).toBeNull();
  });
});

describe("buildOpdsFeed (navegación, esquema Calibre-Web Automated)", () => {
  const feed = buildOpdsFeed({
    kind: "navigation",
    id: "urn:crochety:opds:root",
    title: `Taller "La Seta" · Patrones`,
    selfHref: "/api/opds",
    startHref: "/api/opds",
    updated: "2026-09-05T10:00:00.000Z",
    authorName: "Taller La Seta",
    searchHref: "/api/opds/search/{searchTerms}",
    navigation: [
      {
        id: "/api/opds/patrones",
        title: "Todos los patrones",
        href: "/api/opds/patrones",
        updated: "2026-09-05T10:00:00.000Z",
        content: "Patrones estandarizados",
      },
    ],
  });

  it("declara los perfiles opds-catalog como CWA (kind=navigation en self)", () => {
    expect(feed).toContain(`xmlns="http://www.w3.org/2005/Atom">`);
    expect(feed).not.toContain("xmlns:dc=");
    expect(feed).toContain(
      `<link rel="self" href="/api/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>`,
    );
    expect(feed).toContain(`<link rel="start" href="/api/opds"`);
  });

  it("las secciones usan link sin rel y perfil opds-catalog corto", () => {
    expect(feed).toContain(
      `<link href="/api/opds/patrones" type="application/atom+xml;profile=opds-catalog"/>`,
    );
    expect(feed).toContain(`<content type="text">Patrones estandarizados</content>`);
  });

  it("incluye plantilla de búsqueda y escapa textos", () => {
    expect(feed).toContain(`rel="search" title="Buscar" href="/api/opds/search/{searchTerms}"`);
    expect(feed).toContain(`<title>Taller &quot;La Seta&quot; · Patrones</title>`);
  });
});

describe("buildOpdsFeed (adquisición, esquema Calibre-Web Automated)", () => {
  const feed = buildOpdsFeed({
    kind: "acquisition",
    id: "urn:crochety:opds:/api/opds/patrones",
    title: "Taller · Todos los patrones",
    selfHref: "/api/opds/patrones",
    startHref: "/api/opds",
    updated: "2026-09-05T10:00:00.000Z",
    authorName: "Taller La Seta",
    books: [
      {
        id: "urn:crochety:pattern:abc",
        title: "Osito <Bombero>",
        updated: "2026-09-04T18:00:00.000Z",
        author: "Taller La Seta",
        language: "es",
        categories: ["amigurumi", "navidad"],
        summary: "2 secciones · 20 rondas",
        coverHref: "/api/files/patterns/x.jpg",
        coverMime: "image/jpeg",
        acquisitions: [
          { href: "/api/patterns/abc/export?format=epub", type: "application/epub+zip" },
          { href: "/api/patterns/abc/export?format=md", type: "text/markdown; charset=utf-8" },
        ],
      },
    ],
  });

  it("lleva dc/dcterms y el quirk de self kind=navigation", () => {
    expect(feed).toContain(`xmlns:dc="http://purl.org/dc/terms/"`);
    expect(feed).toContain(`xmlns:dcterms="http://purl.org/dc/terms/"`);
    expect(feed).toContain(
      `type="application/atom+xml;profile=opds-catalog;type=feed;kind=navigation"`,
    );
    expect(feed).toContain(`<link rel="up" href="/api/opds"`);
  });

  it("la entrada imita la estructura de CWA (autor, idioma, tags, portada, formatos)", () => {
    expect(feed).toContain(`<author>
      <name>Taller La Seta</name>
    </author>`);
    expect(feed).toContain(`<dcterms:language>es</dcterms:language>`);
    expect(feed).toContain(`<category scheme="urn:crochety:tags" term="amigurumi" label="amigurumi"/>`);
    expect(feed).toContain(`type="image/jpeg" href="/api/files/patterns/x.jpg" rel="http://opds-spec.org/image"`);
    expect(feed).toContain(`type="image/jpeg" href="/api/files/patterns/x.jpg" rel="http://opds-spec.org/image/thumbnail"`);
    expect(feed).toContain(`rel="http://opds-spec.org/acquisition" href="/api/patterns/abc/export?format=epub" type="application/epub+zip"`);
    expect(feed).toContain(`<title>Osito &lt;Bombero&gt;</title>`);
    // No duplica el enlace de adquisición del EPUB.
    expect(feed.match(/abc\/export\?format=epub/g)).toHaveLength(1);
  });
});

describe("buildOpdsOsd", () => {
  it("genera la descripción OpenSearch con la plantilla de búsqueda", () => {
    const osd = buildOpdsOsd({
      shortName: "Crochety · Patrones",
      description: "Catálogo de patrones",
      template: "/api/opds/search?q={searchTerms}",
    });
    expect(osd).toContain("<OpenSearchDescription");
    expect(osd).toContain(`<ShortName>Crochety · Patrones</ShortName>`);
    expect(osd).toContain(`template="/api/opds/search?q={searchTerms}"`);
  });
});
