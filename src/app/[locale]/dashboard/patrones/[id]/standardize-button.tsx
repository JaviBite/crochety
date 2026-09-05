"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  ConvertingPanel,
  readNdjson,
  useElapsedTimer,
  useStepLabel,
} from "@/components/form/convert-progress";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { SourceProgress } from "@/lib/ai/standardize-source";
import type { PatternAiStatus } from "@/lib/validations";

type StandardizeStreamEvent =
  | SourceProgress
  | { type: "done" }
  | { type: "error"; message: string };

/**
 * (Re)estandariza un patrón desde su página de detalle. Llama a
 * POST /api/patterns/[id]/standardize (mismo pipeline y panel en vivo que el
 * convertidor: pasos en streaming + cronómetro) y refresca al terminar para
 * mostrar el estado final (DONE / MULTIPLE / ERROR).
 */
export function StandardizeButton({
  id,
  aiStatus,
  hasSource,
}: {
  id: string;
  aiStatus: PatternAiStatus;
  hasSource: boolean;
}) {
  const t = useTranslations("Patterns");
  const router = useRouter();
  const toStepLabel = useStepLabel();
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [seconds, resetSeconds] = useElapsedTimer(running);

  const label =
    aiStatus === "DONE"
      ? t("restandardize")
      : aiStatus === "ERROR"
        ? t("retryStandardize")
        : t("standardize");

  function run() {
    resetSeconds();
    setError(null);
    setStep(null);
    setRunning(true);
    void (async () => {
      try {
        const res = await fetch(`/api/patterns/${id}/standardize`, {
          method: "POST",
        });
        if (!res.ok || !res.body) {
          const message = await res.text().catch(() => "");
          setError(
            message.trim() || "La estandarización falló, vuelve a intentarlo",
          );
          setRunning(false);
          router.refresh();
          return;
        }
        await readNdjson<StandardizeStreamEvent>(res, (event) => {
          if (event.type === "done") {
            setStep(null);
            setRunning(false);
            router.refresh();
            return;
          }
          if (event.type === "error") {
            setError(event.message);
            setStep(null);
            setRunning(false);
            router.refresh();
            return;
          }
          setStep(toStepLabel(event));
        });
      } catch {
        setError("La estandarización falló, vuelve a intentarlo");
        setStep(null);
        setRunning(false);
        router.refresh();
      }
    })();
  }

  if (running) {
    return <ConvertingPanel seconds={seconds} step={step} />;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Button
          onClick={run}
          disabled={!hasSource}
          variant={aiStatus === "DONE" ? "outline" : "default"}
        >
          <Sparkles />
          {label}
        </Button>
        {!hasSource && (
          <p className="text-xs text-muted-foreground">
            {t("standardizeNoSource")}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
