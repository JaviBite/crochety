"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter } from "@/i18n/navigation";
import { ORDER_STATUSES } from "@/lib/validations";

/**
 * Filtros del listado de pedidos: chips de estado, asignado y orden. Escribe
 * `status`/`assigned`/`sort` en la URL (los chips limpian su propio parámetro
 * al reactivarlos) y conserva el resto de parámetros (q…).
 */
export function OrderFilters({
  users,
}: {
  users: { id: string; name: string }[];
}) {
  const t = useTranslations("Orders");
  const tStatus = useTranslations("OrderStatus");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get("status");
  const assigned = searchParams.get("assigned");
  const sort = searchParams.get("sort");

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => setParam("status", null)}>
          <Badge
            variant={status ? "outline" : "default"}
            className="h-8 cursor-pointer px-3 text-sm"
          >
            {t("filterAllStatuses")}
          </Badge>
        </button>
        {ORDER_STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setParam("status", status === value ? null : value)}
          >
            <Badge
              variant={status === value ? "default" : "outline"}
              className="h-8 cursor-pointer px-3 text-sm"
            >
              {tStatus.has(value) ? tStatus(value) : value}
            </Badge>
          </button>
        ))}
      </div>

      <Select
        value={assigned ?? "all"}
        onValueChange={(value) => setParam("assigned", value === "all" ? null : value)}
      >
        <SelectTrigger className="h-9 w-40" aria-label={t("filterAssigned")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filterAssignedAll")}</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={sort || "recent"}
        onValueChange={(value) => setParam("sort", value === "recent" ? null : value)}
      >
        <SelectTrigger className="h-9 w-44" aria-label={t("sortLabel")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recent">{t("sortRecent")}</SelectItem>
          <SelectItem value="due">{t("sortDueDate")}</SelectItem>
          <SelectItem value="priceDesc">{t("sortPriceDesc")}</SelectItem>
          <SelectItem value="priceAsc">{t("sortPriceAsc")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
