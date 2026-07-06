import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { PatternForm } from "../pattern-form";

export default async function NewPatternPage() {
  const [t, tags] = await Promise.all([
    getTranslations("Patterns"),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("newTitle")}</h1>
        <p className="text-muted-foreground">{t("newDescription")}</p>
      </div>
      <PatternForm suggestions={tags.map((tag) => tag.name)} />
    </div>
  );
}
