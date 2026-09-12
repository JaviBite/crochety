"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { ChevronDownIcon } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_TONES, orderStatusTone } from "@/lib/status";
import { ORDER_STATUSES } from "@/lib/validations";
import { updateOrderStatus } from "@/app/[locale]/dashboard/pedidos/actions";

// Trigger propio (SelectPrimitive.Trigger directo) para NO heredar el
// `dark:bg-input/30` (y el hover translúcido) del SelectTrigger de shadcn,
// que pisaba el tono sólido del estado en dark. Aquí los colores van planos.
/**
 * Estado del pedido editable en línea (tabla y tarjetas del listado): un
 * select con la estética del badge (puntito + tono por estado) que llama a la
 * action de cambio directo, sin pasar por el form de edición. Error → toast.
 */
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
  // Sobre fotos los sólidos se leen bien; solo el estado "todo" (contorno
  // transparente) conserva fondo de card para no fundirse con la imagen.
  const onCover =
    overlay && tone === ORDER_STATUS_TONES.SIN_EMPEZAR;

  function change(next: string) {
    startTransition(async () => {
      const result = await updateOrderStatus(id, next);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Select value={status} onValueChange={change}>
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        aria-label={label}
        title={label}
        disabled={pending}
        className={cn(
          "flex h-6 w-fit cursor-pointer items-center gap-1.5 rounded-4xl border px-2.5 py-0 text-xs font-medium whitespace-nowrap outline-none select-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          onCover
            ? "border-foreground/40 bg-card/95 text-foreground shadow-md backdrop-blur-sm hover:bg-card"
            : overlay
              ? cn("border-transparent shadow-md hover:opacity-95", tone.className)
              : cn("hover:opacity-95", tone.className),
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
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "pointer-events-none size-3 shrink-0 opacity-60",
            overlay ? "text-muted-foreground" : "opacity-70",
          )}
        />
      </SelectPrimitive.Trigger>
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
