"use client";

import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Link } from "@/i18n/navigation";
import { colorToParam } from "@/lib/search";
import { cn } from "@/lib/utils";

/**
 * Filtro por color dominante para materiales: selector de muestras en un
 * popover (antes una fila con TODOS los colores sueltos, que envolvía feo).
 * El disparador muestra el color activo o un muestrario neutro; dentro, una
 * cuadrícula con cada color presente en el inventario. Cada muestra añade
 * `?color=<hex>` a la ruta y conserva el resto de filtros.
 */
export function ColorFilter({
  colors,
  activeColor,
  basePath,
  preserveQuery = {},
}: {
  /** Colores #RRGGBB distintos presentes en el inventario. */
  colors: string[];
  /** Valor del parámetro `color` activo (hex sin almohadilla), si lo hay. */
  activeColor?: string;
  basePath: string;
  /** Otros filtros activos (q, tag) que el selector no debe perder. */
  preserveQuery?: Record<string, string | undefined>;
}) {
  const t = useTranslations("Materials");
  const base = Object.fromEntries(
    Object.entries(preserveQuery).filter(([, value]) => value),
  ) as Record<string, string>;
  const activeHex = activeColor
    ? colors.find((color) => colorToParam(color) === activeColor)
    : undefined;

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors hover:bg-accent",
          activeHex ? "border-primary/50 text-foreground" : "text-muted-foreground",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-4 shrink-0 rounded-full border border-foreground/15",
            !activeHex && "bg-muted",
          )}
          style={activeHex ? { backgroundColor: activeHex } : undefined}
        />
        {t("colorFilter")}
        <ChevronDown aria-hidden className="size-3.5 opacity-60" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 w-64 rounded-xl bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          {colors.length > 0 && (
            <div className="grid grid-cols-8 gap-1.5">
              {colors.map((color) => {
                const value = colorToParam(color);
                const active = activeColor === value;
                return (
                  <Link
                    key={color}
                    href={{ pathname: basePath, query: { ...base, color: value } }}
                    aria-label={t("colorFilterOne", { color })}
                    title={color}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border border-foreground/10 transition-transform hover:scale-110",
                      active && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {active && (
                      <Check className="size-4 text-white mix-blend-difference" />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
          <div className="mt-3 border-t pt-2">
            <Link
              href={{ pathname: basePath, query: base }}
              className={cn(
                "text-xs font-medium transition-colors",
                activeColor
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-primary",
              )}
            >
              {t("colorFilterAll")}
            </Link>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
