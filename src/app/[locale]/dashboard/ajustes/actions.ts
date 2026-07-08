"use server";

import { revalidatePath } from "next/cache";
import { auth, isAdmin } from "@/lib/auth";
import { parseSettingsForm } from "@/lib/forms";
import {
  apiKeySettingFor,
  saveSettings,
  type SettingKey,
} from "@/lib/settings";

export type SettingsActionState = { error: string } | { success: true } | null;

export async function updateSettings(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await auth();
  if (!isAdmin(session)) return { error: "No autorizado" };

  const parsed = parseSettingsForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const data = parsed.data;

  const entries: Partial<Record<SettingKey, string | null>> = {
    // null borra la fila y se vuelve al valor por defecto / variable de entorno.
    workshopName: data.workshopName,
    workshopTagline: data.workshopTagline,
    galleryEnabled: data.galleryEnabled ? null : "false",
    defaultAccent: data.defaultAccent,
    aiProvider: data.aiProvider,
    aiModel: data.aiModel,
    ollamaBaseUrl: data.ollamaBaseUrl,
  };

  // La clave API solo se toca para el proveedor seleccionado: en blanco se
  // conserva la guardada; "clearApiKey" la borra (vuelve al env si existe).
  if (data.aiProvider !== "ollama") {
    if (data.clearApiKey) {
      entries[apiKeySettingFor(data.aiProvider)] = null;
    } else if (data.apiKey) {
      entries[apiKeySettingFor(data.aiProvider)] = data.apiKey;
    }
  }

  await saveSettings(entries);

  revalidatePath("/", "layout");
  return { success: true };
}
