import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { MaterialForm } from "../../material-form";

export default async function EditMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [t, material, tags] = await Promise.all([
    getTranslations("Materials"),
    prisma.material.findUnique({
      where: { id },
      include: { tags: { select: { name: true }, orderBy: { name: "asc" } } },
    }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  if (!material) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("editTitle")}</h1>
        <p className="text-muted-foreground">{t("editDescription")}</p>
      </div>
      <MaterialForm
        material={material}
        suggestions={tags.map((tag) => tag.name)}
      />
    </div>
  );
}
