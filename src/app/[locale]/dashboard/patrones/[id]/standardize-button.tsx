"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { PatternAiStatus } from "@/lib/validations";
import { standardizePatternAction } from "../actions";

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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const label =
    aiStatus === "DONE"
      ? t("restandardize")
      : aiStatus === "ERROR"
        ? t("retryStandardize")
        : t("standardize");

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await standardizePatternAction(id);
      if (result?.error) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Button
          onClick={run}
          disabled={pending || !hasSource}
          variant={aiStatus === "DONE" ? "outline" : "default"}
        >
          <Sparkles />
          {pending ? t("standardizing") : label}
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
