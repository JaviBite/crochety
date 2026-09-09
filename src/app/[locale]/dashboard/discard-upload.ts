"use server";

import { auth } from "@/lib/auth";
import { isValidUploadPath } from "@/lib/files";
import { deleteUpload } from "@/lib/files.server";

/**
 * Borra del storage un fichero huérfano: una foto recién subida en un form y
 * descartada con la X antes de guardar. Best-effort: si el storage falla no
 * rompe el formulario (la limpieza real la hacen las actions al guardar).
 */
export async function discardUploadAction(
  path: string,
): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };
  if (!isValidUploadPath(path)) return { error: "Ruta inválida" };
  try {
    await deleteUpload(path);
  } catch {
    // ignorado: la acción de guardado repetirá la limpieza si hace falta
  }
}
