import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { colorToParam } from "@/lib/search";

/**
 * Filtro por color dominante para materiales: una muestra por cada color
 * presente en el inventario. Cada muestra añade `?color=<hex>` a la ruta y
 * conserva el resto de filtros. Render de servidor, como TagFilter.
 */
export async function ColorFilter({
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
  preserveQuery?: Record<string, string | undefined>;
}) {
  if (colors.length === 0) return null;
  const t = await getTranslations("Materials");
  const base = Object.fromEntries(
    Object.entries(preserveQuery).filter(([, value]) => value),
  ) as Record<string, string>;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link
        href={{ pathname: basePath, query: base }}
        aria-label={t("colorFilterAll")}
        title={t("colorFilterAll")}
        className={cn(
          "flex h-6 items-center rounded-full border px-2 text-xs transition-colors",
          activeColor
            ? "text-muted-foreground hover:text-foreground"
            : "border-primary bg-primary/10 font-medium text-foreground",
        )}
      >
        {t("colorFilterAll")}
      </Link>
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
              "size-6 rounded-full border transition-transform hover:scale-110",
              active && "ring-2 ring-ring ring-offset-2 ring-offset-background",
            )}
            style={{ backgroundColor: color }}
          />
        );
      })}
    </div>
  );
}
