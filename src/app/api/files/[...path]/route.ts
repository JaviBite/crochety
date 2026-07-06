import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { EXT_TO_MIME, resolveUploadPath } from "@/lib/files";

export const runtime = "nodejs";

/**
 * GET /api/files/{kind}/{fichero} — sirve ficheros del volumen de uploads.
 * Las imágenes son públicas (la galería las necesita); los ficheros de
 * patrones (PDF/DOCX) requieren sesión.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const relPath = segments.join("/");

  const absPath = resolveUploadPath(relPath);
  if (!absPath) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }

  const ext = path.extname(absPath).toLowerCase();
  const mime = EXT_TO_MIME[ext];
  if (!mime) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  // Los patrones son material privado.
  if (segments[0] === "patterns") {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  try {
    const data = await readFile(absPath);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
}
