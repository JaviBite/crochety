import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { MaterialForm } from "../material-form";

export default async function NewMaterialPage() {
  const [t, tags] = await Promise.all([
    getTranslations("Materials"),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("newTitle")}</h1>
        <p className="text-muted-foreground">{t("newDescription")}</p>
      </div>
      <MaterialForm suggestions={tags.map((tag) => tag.name)} />
    </div>
  );
}
