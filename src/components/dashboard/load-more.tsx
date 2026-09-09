import { ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * "Cargar más" para listados paginados por recuento (`?n=`): enlaza a la misma
 * URL con N más elementos, conservando búsqueda y filtros. Sin estado ni JS:
 * el server component renderiza la lista acumulada.
 */
export async function LoadMore({
  basePath,
  nextCount,
  preserveQuery = {},
}: {
  basePath: string;
  /** Valor de `?n=` para el siguiente bloque. */
  nextCount: number;
  preserveQuery?: Record<string, string | undefined>;
}) {
  const tForms = await getTranslations("Forms");
  const base = Object.fromEntries(
    Object.entries(preserveQuery).filter(([, value]) => value),
  ) as Record<string, string>;

  return (
    <div className="flex justify-center pt-1">
      <Button variant="outline" asChild>
        <Link href={{ pathname: basePath, query: { ...base, n: nextCount } }}>
          <ChevronDown aria-hidden className="size-4" />
          {tForms("loadMore")}
        </Link>
      </Button>
    </div>
  );
}
