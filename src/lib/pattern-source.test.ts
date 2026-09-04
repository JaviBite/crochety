import { describe, expect, it } from "vitest";
import {
  collectHtmlImageUrls,
  findOgImage,
  htmlToText,
  looksLikeBotChallenge,
  looksLikePatternText,
  pickCoverImage,
} from "./pattern-source";

describe("looksLikeBotChallenge", () => {
  it("detecta retos reales (página intermedia de Cloudflare)", () => {
    expect(looksLikeBotChallenge("<title>Just a moment...</title>")).toBe(true);
    expect(looksLikeBotChallenge("Enable JavaScript and cookies to continue")).toBe(
      true,
    );
    expect(looksLikeBotChallenge("var s={c:(window._cf_chl_opt={})};")).toBe(true);
    expect(looksLikeBotChallenge("/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1")).toBe(
      true,
    );
  });

  it("no marca como reto el script JSD normal de sitios tras Cloudflare", () => {
    expect(
      looksLikeBotChallenge(
        "a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js'",
      ),
    ).toBe(false);
    expect(looksLikeBotChallenge("<html><body>Patrón normal</body></html>")).toBe(
      false,
    );
  });
});

describe("htmlToText", () => {
  it("quita scripts/estilos y convierte bloques en saltos de línea", () => {
    const html = `<html><head><title>x</title><style>p{color:red}</style></head>
      <body><script>alert(1)</script>
      <h1>Patrón pulpo</h1>
      <p>R1: 6 pb en anillo mágico</p>
      <p>R2: aum x6 (12)</p>
      </body></html>`;
    const text = htmlToText(html);
    expect(text).toContain("Patrón pulpo");
    expect(text).toContain("R1: 6 pb en anillo mágico\nR2: aum x6 (12)");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color:red");
  });

  it("decodifica las entidades HTML habituales", () => {
    expect(htmlToText("6&nbsp;pb &amp; 2 aum &lt;3 &quot;osito&quot;")).toBe(
      '6 pb & 2 aum <3 "osito"',
    );
  });

  it("colapsa espacios repetidos", () => {
    expect(htmlToText("<div>  hola \t  mundo  </div>")).toBe("hola mundo");
  });
});

describe("findOgImage", () => {
  it("encuentra la og:image con property antes o después de content", () => {
    expect(
      findOgImage('<meta property="og:image" content="https://x.com/a.jpg">'),
    ).toBe("https://x.com/a.jpg");
    expect(
      findOgImage('<meta content="https://x.com/b.jpg" property="og:image">'),
    ).toBe("https://x.com/b.jpg");
  });

  it("acepta name= y og:image:secure_url", () => {
    expect(
      findOgImage('<meta name="og:image" content="/foto.png">'),
    ).toBe("/foto.png");
    expect(
      findOgImage(
        '<meta property="og:image:secure_url" content="https://x.com/s.jpg">',
      ),
    ).toBe("https://x.com/s.jpg");
  });

  it("devuelve null si no hay og:image", () => {
    expect(findOgImage("<html><body>sin meta</body></html>")).toBeNull();
    expect(findOgImage('<meta property="og:title" content="x">')).toBeNull();
  });
});

describe("pickCoverImage", () => {
  it("elige la imagen más grande que supere el mínimo", () => {
    const images = [
      { width: 300, height: 300, key: "media" },
      { width: 800, height: 600, key: "grande" },
      { width: 250, height: 400, key: "otra" },
    ];
    expect(pickCoverImage(images)?.key).toBe("grande");
  });

  it("descarta iconos y separadores pequeños", () => {
    expect(
      pickCoverImage([
        { width: 32, height: 32 },
        { width: 1000, height: 8 },
        { width: 150, height: 900 },
      ]),
    ).toBeNull();
  });

  it("devuelve null sin imágenes", () => {
    expect(pickCoverImage([])).toBeNull();
  });
});

describe("collectHtmlImageUrls", () => {
  const base = "https://blog.example.com/patron/";

  it("recoge og:image e <img>, resuelve relativas y quita duplicados", () => {
    const html = `
      <meta property="og:image" content="https://cdn.example.com/portada.jpg">
      <img src="foto1.jpg">
      <img src="/assets/foto2.png">
      <img src="https://cdn.example.com/portada.jpg">
    `;
    expect(collectHtmlImageUrls(html, base)).toEqual([
      "https://cdn.example.com/portada.jpg",
      "https://blog.example.com/patron/foto1.jpg",
      "https://blog.example.com/assets/foto2.png",
    ]);
  });

  it("descarta data:, svg y basura (logos, iconos, avatares)", () => {
    const html = `
      <img src="data:image/png;base64,AAAA">
      <img src="/img/logo.png">
      <img src="/icons/menu.svg">
      <img src="https://gravatar.com/avatar/abc">
      <img src="/fotos/amigurumi.jpg">
    `;
    expect(collectHtmlImageUrls(html, base)).toEqual([
      "https://blog.example.com/fotos/amigurumi.jpg",
    ]);
  });

  it("usa la primera URL de srcset", () => {
    const html = `<img srcset="/small.jpg 480w, /big.jpg 1200w">`;
    expect(collectHtmlImageUrls(html, base)).toEqual([
      "https://blog.example.com/small.jpg",
    ]);
  });
});

describe("looksLikePatternText", () => {
  it("detecta rondas numeradas en español e inglés", () => {
    expect(looksLikePatternText("R1: 6 pb en anillo mágico")).toBe(true);
    expect(looksLikePatternText("Ronda 5: aum en cada punto (12)")).toBe(true);
    expect(looksLikePatternText("Row 3: dc in each st")).toBe(true);
    expect(looksLikePatternText("R4-R7\n12 sc")).toBe(true);
  });

  it("detecta conteos de puntos y abreviaturas", () => {
    expect(looksLikePatternText("haz 6 pb y luego 2 aum")).toBe(true);
    expect(looksLikePatternText("12sc in next st")).toBe(true);
    expect(looksLikePatternText("trabaja 18 pa")).toBe(true);
  });

  it("detecta el anillo mágico y el amigurumi", () => {
    expect(looksLikePatternText("empieza con un anillo mágico")).toBe(true);
    expect(looksLikePatternText("make a magic ring")).toBe(true);
  });

  it("rechaza texto que no es un patrón", () => {
    expect(
      looksLikePatternText(
        "Ingredientes: 500 g de harina, 200 ml de leche y 3 huevos. Precalienta el horno a 180 grados.",
      ),
    ).toBe(false);
    expect(
      looksLikePatternText(
        "Bienvenido a mi blog. Hoy hablamos de cómo plantar rosales y del abonado de primavera.",
      ),
    ).toBe(false);
    expect(looksLikePatternText("")).toBe(false);
  });
});
