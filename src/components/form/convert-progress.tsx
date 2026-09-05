"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { SourceProgress } from "@/lib/ai/standardize-source";

// Panel de progreso en vivo compartido por el convertidor (/api/convert) y el
// botón de estandarizar del detalle del patrón (/api/patterns/[id]/standardize).
// El pipeline emite eventos NDJSON (una línea JSON por evento) y la UI pinta
// el paso actual más un cronómetro: la IA tarda 1-3 min por patrón y sin
// feedback parece colgada.

/** Lee un body NDJSON y emite cada evento parseado (líneas corruptas se ignoran). */
export async function readNdjson<T>(
  response: Response,
  onEvent: (event: T) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onEvent(JSON.parse(line) as T);
      } catch {
        // Línea corrupta: se ignora.
      }
    }
  }
}

/** Segundos → "m:ss" para el cronómetro de conversión. */
export function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Cronómetro: el tictac corre solo mientras `running`; el llamador llama a
 *  reset() al (re)iniciar para volver a 0. */
export function useElapsedTimer(
  running: boolean,
): [seconds: number, reset: () => void] {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return [seconds, () => setSeconds(0)];
}

/** Traduce un evento del pipeline a un mensaje de paso para la UI. */
export function useStepLabel(): (event: SourceProgress) => string | null {
  const t = useTranslations("Convertidor");
  return (event) => {
    switch (event.type) {
      case "extract":
        return t("stepExtract");
      case "text-ready":
        return t("stepTextReady", { chars: event.chars.toLocaleString() });
      case "images-ready":
        return t("stepImagesReady", { count: event.count });
      case "standardizing":
        return t("stepStandardizing");
      case "segmenting":
        return t("stepSegmenting");
      case "segment":
        return t("stepSegment", { index: event.index, total: event.total });
      case "rasterizing":
        return t("stepRasterizing");
      case "vision-retry":
        return t("stepVisionRetry");
      default:
        return null;
    }
  };
}

export function ConvertingPanel({
  seconds,
  step,
}: {
  seconds: number;
  step: string | null;
}) {
  const t = useTranslations("Convertidor");
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed p-4">
      <LoaderCircle className="size-5 shrink-0 animate-spin text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{step ?? t("convertingTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("convertingHint")}</p>
      </div>
      <span className="ml-auto shrink-0 tabular-nums text-sm text-muted-foreground">
        {formatElapsed(seconds)}
      </span>
    </div>
  );
}
