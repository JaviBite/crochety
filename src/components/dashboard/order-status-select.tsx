"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { orderStatusTone, type StatusTone } from "@/lib/status";
import { ORDER_STATUSES } from "@/lib/validations";
import { updateOrderStatus } from "@/app/[locale]/dashboard/pedidos/actions";

/**
 * Estado del pedido editable en línea (tabla y tarjetas del listado): un
 * select con la estética del badge (puntito + tono por estado) que llama a la
 * action de cambio directo, sin pasar por el form de edición. Error → toast.
 *
 * Los tonos van marcados Important: el trigger de shadcn declara
 * `dark:bg-input/30` (y hovers) que pisa cualquier `bg-*` normal en dark.
 */
function tonePill(tone: StatusTone): string {
  return tone.className.split(" ").filter(Boolean).map((c) => `${c}!`).join(" ");
}

export function OrderStatusSelect({
  id,
  status,
  overlay = false,
}: {
  id: string;
  status: string;
  /** Sobre la portada de una tarjeta: fondo tipo card, sin tono de estado. */
  overlay?: boolean;
}) {
  const t = useTranslations("OrderStatus");
  const tCommon = useTranslations("Common");
  const [pending, startTransition] = useTransition();
  const tone = orderStatusTone(status);
  const label = t.has(status) ? t(status) : tCommon("unknownStatus");

  function change(next: string) {
    startTransition(async () => {
      const result = await updateOrderStatus(id, next);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Select value={status} onValueChange={change}>
      <SelectTrigger
        aria-label={`${label}.`}
        title={label}
        disabled={pending}
        className={cn(
          "h-6 w-fit gap-1.5 rounded-4xl border-transparent! bg-transparent px-2.5 py-0 text-xs font-medium",
          overlay
            ? "bg-card/95! text-foreground! shadow-sm dark:bg-card/95! dark:hover:bg-card!"
            : tonePill(tone),
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            overlay ? "bg-foreground/60" : tone.dot,
          )}
        />
        <SelectValue>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        {ORDER_STATUSES.map((statusOption) => (
          <SelectItem key={statusOption} value={statusOption}>
            {t.has(statusOption) ? t(statusOption) : statusOption}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
