import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { PATTERN_AI_STATUSES } from "@/lib/validations";

/**
 * Filtro por estado de IA para el listado de patrones, al estilo de
 * `TagFilter`: chips-enlace que escriben `?ai=<estado>` y conservan el resto
 * de parámetros (q, tag).
 */
export async function AiStatusFilter({
  active,
  basePath,
  preserveQuery = {},
}: {
  active?: string;
  basePath: string;
  preserveQuery?: Record<string, string | undefined>;
}) {
  const t = await getTranslations("Patterns");
  const tStatus = await getTranslations("PatternAiStatus");
  const base = Object.fromEntries(
    Object.entries(preserveQuery).filter(([, value]) => value),
  ) as Record<string, string>;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link href={{ pathname: basePath, query: base }}>
        <Badge
          variant={active ? "outline" : "default"}
          className="h-8 cursor-pointer px-3 text-sm"
        >
          {t("filterAllAi")}
        </Badge>
      </Link>
      {PATTERN_AI_STATUSES.map((status) => {
        const isActive = active === status;
        return (
          <Link
            key={status}
            href={{ pathname: basePath, query: { ...base, ai: status } }}
          >
            <Badge
              variant={isActive ? "default" : "outline"}
              className="h-8 cursor-pointer px-3 text-sm"
            >
              {tStatus.has(status) ? tStatus(status) : status}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}
