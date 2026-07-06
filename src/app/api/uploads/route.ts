import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isUploadKind, saveUpload, UploadError } from "@/lib/files";

export const runtime = "nodejs";

/**
 * POST /api/uploads — sube un fichero (solo usuarios autenticados).
 * FormData: file (File), kind ("materials" | "orders" | "patterns").
 * Respuesta: { path } relativo, listo para persistir en la BD.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = formData.get("kind");

  if (!(file instanceof File) || typeof kind !== "string" || !isUploadKind(kind)) {
    return NextResponse.json(
      { error: "Petición inválida: se esperan 'file' y 'kind'" },
      { status: 400 },
    );
  }

  try {
    const relPath = await saveUpload(kind, file);
    return NextResponse.json({ path: relPath }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
