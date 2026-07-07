import { describe, expect, it } from "vitest";
import { findOgImage, htmlToText, pickCoverImage } from "./pattern-source";

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
