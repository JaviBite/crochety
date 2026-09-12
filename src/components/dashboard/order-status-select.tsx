"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { orderStatusTone } from "@/lib/status";
import { ORDER_STATUSES } from "@/lib/validations";
import { updateOrderStatus } from "@/app/[locale]/dashboard/pedidos/actions";

/**
 * Estado del pedido editable en línea (tabla y tarjetas del listado): un
 * select con la estética del badge (puntito + tono por estado) que llama a la
 * action de cambio directo, sin pasar por el form de edición. Error → toast.
 */
export function OrderStatusSelect({
  id,
  status,
  className,
}: {
  id: string;
  status: string;
  className?: string;
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
        aria-label={`${label} (${t.has(status) ? t(status) : status}).`}
        title={label}
        disabled={pending}
        className={cn(
          "h-6 w-fit gap-1.5 rounded-4xl border-transparent px-2.5 py-0 text-xs font-medium",
          tone.className,
          className,
        )}
      >
        <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
        <SelectValue>{label}</SelectValue>
        <ChevronDown className="size-3 shrink-0 opacity-50" aria-hidden />
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
