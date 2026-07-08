import { ArrowLeft, Boxes, ExternalLink, MapPin, Pencil } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

const BASE_PATH = "/dashboard/materiales";

export default async function MaterialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, tCategory, locale, material] = await Promise.all([
    getTranslations("Materials"),
    getTranslations("MaterialCategory"),
    getLocale(),
    prisma.material.findUnique({
      where: { id },
      include: { tags: { select: { name: true }, orderBy: { name: "asc" } } },
    }),
  ]);

  if (!material) notFound();

  return (
    <div className="space-y-6">
      <Link href={BASE_PATH} className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        {t("detailBack")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{material.name}</h1>
            <Badge variant="secondary">{tCategory(material.category)}</Badge>
          </div>
          <p className="text-muted-foreground">{t("inStock", { count: material.stock })} · {formatCents(material.priceCents, locale)}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`${BASE_PATH}/editar/${material.id}`}>
            <Pencil className="size-4" />
            {t("editTitle")}
          </Link>
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("fieldName")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">{t("fieldBrand")}</p>
                <p>{material.brand ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">{t("fieldFiberType")}</p>
                <p>{material.fiberType ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">{t("fieldWeight")}</p>
                <p>{material.weight ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">{t("fieldLocation")}</p>
                <p>{material.location ?? "—"}</p>
              </div>
            </div>
            {material.link && (
              <a href={material.link} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 text-foreground hover:underline">
                <ExternalLink className="size-4" />
                {t("fieldLink")}
              </a>
            )}
            {material.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {material.tags.map((tag) => (
                  <Badge key={tag.name} variant="outline">{tag.name}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("fieldPhoto")}</CardTitle>
          </CardHeader>
          <CardContent>
            {material.photoPath ? (
              <img src={`/api/files/${material.photoPath}`} alt={material.name} className="w-full rounded-xl border object-cover" />
            ) : (
              <div className="flex min-h-40 items-center justify-center rounded-xl border bg-accent/10 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Boxes className="size-5" />
                  <span>{t("fieldPhoto")}</span>
                </div>
              </div>
            )}
            {material.colorHex && (
              <div className="mt-3 text-sm text-muted-foreground">
                <span>{t("fieldColor")}: {material.colorHex}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
