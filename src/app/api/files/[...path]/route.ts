import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { EXT_TO_MIME } from "@/lib/files";
import { readUpload } from "@/lib/files.server";

export const runtime = "nodejs";

/**
 * GET /api/files/{kind}/{fichero} — sirve ficheros del almacenamiento de
 * subidas (Vercel Blob en producción, disco en dev; la URL interna nunca
 * llega al cliente). Las imágenes son públicas (la galería las necesita,
 * incluidas las portadas de patrón que hacen de fallback de pedido) y
 * cacheables en la CDN; los documentos de patrones (PDF/DOCX) y las fotos
 * de compra requieren sesión y no se cachean en compartido.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const relPath = segments.join("/");

  const ext = path.extname(relPath).toLowerCase();
  const mime = EXT_TO_MIME[ext];
  if (!mime) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  // Material privado: los documentos del patrón (el patrón en sí, que puede
  // ser de pago) y las fotos de compra. Las portadas de patrón son imágenes
  // y se sirven públicas: la galería pública las usa como fallback de pedido.
  const isPrivate =
    segments[0] === "expenses" ||
    (segments[0] === "patterns" && !mime.startsWith("image/"));
  if (isPrivate) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const content = await readUpload(relPath);
  if (!content) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  // Los pathnames llevan UUID y nunca se reutilizan (reemplazar = nombre
  // nuevo), así que todo es inmutable: los privados se cachean en el navegador
  // (nunca en compartido) y los públicos también en la CDN de Vercel, que
  // requiere s-maxage para cachear respuestas de funciones.
  return new Response(content, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": isPrivate
        ? "private, max-age=31536000, immutable"
        : "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}
