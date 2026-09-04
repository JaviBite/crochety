"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter } from "@/i18n/navigation";
import type { StandardizedPattern } from "@/lib/ai/standardize-pattern";
import { keepAllPatterns, keepPattern } from "../actions";

/**
 * Revisión human-in-the-loop: la IA detectó varios patrones en el origen.
 * El usuario elige guardarlo todo (el resto nacen como Patterns hermanos) o
 * quedarse solo con uno (el resto se descarta).
 */
export function MultiPatternReview({
  id,
  patterns,
}: {
  id: string;
  patterns: StandardizedPattern[];
}) {
  const t = useTranslations("Patterns");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error: string } | void>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
      router.refresh();
    });
  }

  return (
    <Card className="rounded-2xl border-amber-500/40 shadow-sm">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">
            {t("multiReviewTitle", { count: patterns.length })}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("multiReviewDescription")}
          </p>
        </div>
        <Button disabled={pending} onClick={() => run(() => keepAllPatterns(id))}>
          {t("multiKeepAll")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {patterns.map((pattern, index) => {
          const rounds = pattern.sections.reduce(
            (sum, section) => sum + section.rounds.length,
            0,
          );
          return (
            <div
              key={index}
              className="flex items-center gap-3 rounded-xl border px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {pattern.title || t("multiUntitled")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("multiPatternMeta", {
                    sections: pattern.sections.length,
                    rounds,
                  })}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => run(() => keepPattern(id, index))}
              >
                {t("multiKeepThis")}
              </Button>
            </div>
          );
        })}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
