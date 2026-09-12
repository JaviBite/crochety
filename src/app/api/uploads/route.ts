import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isUploadKind, UploadError } from "@/lib/files";
import { saveUpload } from "@/lib/files.server";

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
    // Siempre JSON: si el error sale como HTML (500 por defecto), el cliente
    // no puede leerlo y el usuario solo ve un mensaje genérico.
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[uploads] fallo al guardar fichero:", {
      kind,
      name: file.name,
      size: file.size,
      type: file.type,
      error,
    });
    const detail =
      error instanceof Error && error.message
        ? ` — ${error.message.split("\n")[0]}`
        : "";
    return NextResponse.json(
      { error: `No se pudo guardar el fichero en el almacenamiento${detail}` },
      { status: 500 },
    );
  }
}
