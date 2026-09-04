"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Página de error de la app: muestra el mensaje real (o uno genérico si el
 * fallo no lo da) con botón de reintentar, en vez del error pelado de Vercel.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Errors");

  useEffect(() => {
    // El stack completo queda en la consola/telemetría; aquí solo el resumen.
    console.error("[app-error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <CircleAlert className="size-10 text-destructive" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {error.message || t("description")}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/70">
            {t("digest")}: {error.digest}
          </p>
        )}
      </div>
      <Button onClick={reset} variant="outline">
        <RotateCcw />
        {t("retry")}
      </Button>
    </div>
  );
}
