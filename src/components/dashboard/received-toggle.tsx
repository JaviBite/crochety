"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toggleExpenseReceived } from "@/app/[locale]/dashboard/gastos/actions";
import { cn } from "@/lib/utils";

/**
 * Toggle "recibido" en la fila del listado de gastos: un clic marca/desmarca
 * sin pasar por el form de edición. Pendiente = badge destructive; recibido =
 * texto discreto con check.
 */
export function ReceivedToggle({
  id,
  received,
}: {
  id: string;
  received: boolean;
}) {
  const t = useTranslations("Expenses");
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await toggleExpenseReceived(id);
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={toggle}
      aria-label={received ? t("markPending") : t("markReceived")}
      title={received ? t("markPending") : t("markReceived")}
      className={cn(
        "inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors disabled:opacity-60",
        received
          ? "border-transparent text-muted-foreground hover:text-foreground"
          : "border-transparent bg-destructive/15 text-destructive hover:bg-destructive/25",
      )}
    >
      {received && <Check aria-hidden className="size-3.5" />}
      {received ? t("received") : t("pending")}
    </button>
  );
}
