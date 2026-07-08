import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { PatternBatchForm } from "./batch-form";

export default async function BatchPatternsPage() {
  const [t, tags] = await Promise.all([
    getTranslations("Patterns"),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("batchTitle")}</h1>
        <p className="text-muted-foreground">{t("batchDescription")}</p>
      </div>
      <PatternBatchForm suggestions={tags.map((tag) => tag.name)} />
    </div>
  );
}
