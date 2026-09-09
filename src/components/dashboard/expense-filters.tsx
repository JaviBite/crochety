import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";

/**
 * Filtros del listado de gastos (estilo TagFilter): estado de recepción
 * (todas/recibidos/pendientes) y quién pagó, como chips-enlace que escriben
 * `received`/`paidBy` en la URL y conservan el resto de parámetros (q…).
 */
export async function ExpenseFilters({
  users,
  activeReceived,
  activePaidBy,
  basePath,
  preserveQuery = {},
}: {
  users: { id: string; name: string }[];
  activeReceived?: string;
  activePaidBy?: string;
  basePath: string;
  preserveQuery?: Record<string, string | undefined>;
}) {
  const t = await getTranslations("Expenses");
  const base = Object.fromEntries(
    Object.entries(preserveQuery).filter(([, value]) => value),
  ) as Record<string, string>;

  const receivedOptions = [
    { value: undefined, label: t("filterAllReceived") },
    { value: "received", label: t("received") },
    { value: "pending", label: t("pending") },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {receivedOptions.map((option) => (
          <Link
            key={option.label}
            href={{
              pathname: basePath,
              query: { ...base, ...(option.value ? { received: option.value } : {}) },
            }}
          >
            <Badge
              variant={
                (activeReceived ?? undefined) === option.value
                  ? "default"
                  : "outline"
              }
              className="h-8 cursor-pointer px-3 text-sm"
            >
              {option.label}
            </Badge>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={{ pathname: basePath, query: base }}>
          <Badge
            variant={activePaidBy ? "outline" : "default"}
            className="h-8 cursor-pointer px-3 text-sm"
          >
            {t("filterAllPaidBy")}
          </Badge>
        </Link>
        {users.map((user) => {
          const isActive = activePaidBy === user.id;
          return (
            <Link
              key={user.id}
              href={{ pathname: basePath, query: { ...base, paidBy: user.id } }}
            >
              <Badge
                variant={isActive ? "default" : "outline"}
                className="h-8 cursor-pointer px-3 text-sm"
              >
                {user.name}
              </Badge>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
