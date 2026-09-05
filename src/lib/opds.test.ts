import { describe, expect, it } from "vitest";
import {
  buildOpdsFeed,
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

describe("buildOpdsFeed", () => {
  const feed = buildOpdsFeed({
    id: "urn:crochety:opds:patterns",
    title: `Taller "La Seta" · Patrones`,
    selfHref: "/api/opds",
    updated: "2026-09-05T10:00:00.000Z",
    entries: [
      {
        id: "urn:crochety:pattern:abc",
        title: "Osito <Bombero>",
        updated: "2026-09-04T18:00:00.000Z",
        summary: "2 secciones · 20 rondas",
        coverHref: "/api/files/patterns/x.jpg",
        coverMime: "image/jpeg",
        acquisitions: [
          { href: "/api/patterns/abc/export?format=epub", type: "application/epub+zip" },
          { href: "/api/patterns/abc/export?format=md", type: "text/markdown; charset=utf-8" },
        ],
      },
    ],
    nextHref: "/api/opds?page=2",
  });

  it("genera Atom con escape correcto en textos y atributos", () => {
    expect(feed).toContain(`<?xml version="1.0" encoding="utf-8"?>`);
    expect(feed).toContain(`<title>Taller &quot;La Seta&quot; · Patrones</title>`);
    expect(feed).toContain(`<title>Osito &lt;Bombero&gt;</title>`);
    expect(feed).toContain(`<link rel="self" href="/api/opds"/>`);
    expect(feed).toContain(`<link rel="next" href="/api/opds?page=2"/>`);
  });

  it("incluye portada y enlaces de adquisición por entrada", () => {
    expect(feed).toContain(`rel="http://opds-spec.org/image/thumbnail" href="/api/files/patterns/x.jpg"`);
    expect(feed).toContain(`rel="http://opds-spec.org/acquisition" href="/api/patterns/abc/export?format=epub" type="application/epub+zip"`);
    expect(feed).toContain(`rel="http://opds-spec.org/acquisition" href="/api/patterns/abc/export?format=md"`);
    // No duplica el primer enlace de adquisición.
    expect(feed.match(/abc\/export\?format=epub/g)).toHaveLength(1);
  });

  it("omite el enlace next y la portada cuando no aplican", () => {
    const minimal = buildOpdsFeed({
      id: "urn:crochety:opds:patterns",
      title: "Crochety · Patrones",
      selfHref: "/api/opds",
      updated: "2026-09-05T10:00:00.000Z",
      entries: [],
      nextHref: null,
    });
    expect(minimal).not.toContain(`rel="next"`);
    expect(minimal).not.toContain("image/thumbnail");
  });
});
