import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { EXT_TO_MIME, resolveUploadUrl } from "@/lib/files";

export const runtime = "nodejs";

/**
 * GET /api/files/{kind}/{fichero} — sirve ficheros haciendo proxy de Vercel
 * Blob (la URL del blob nunca llega al cliente). Las imágenes son públicas
 * (la galería las necesita) y cacheables en el CDN; los ficheros de patrones
 * (PDF/DOCX) requieren sesión y no se cachean en compartido.
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

  // Los patrones son material privado.
  const isPattern = segments[0] === "patterns";
  if (isPattern) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const blobUrl = await resolveUploadUrl(relPath);
  if (!blobUrl) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const blob = await fetch(blobUrl);
  if (!blob.ok || !blob.body) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return new Response(blob.body, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": isPattern
        ? "private, max-age=0, must-revalidate"
        : "public, max-age=31536000, immutable",
    },
  });
}
