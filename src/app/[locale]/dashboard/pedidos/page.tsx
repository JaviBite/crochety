import { Package } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";

export default async function OrdersPage() {
  const t = await getTranslations("Orders");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <EmptyState
        icon={Package}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    </div>
  );
}
