import { Boxes, ExternalLink, MapPin, Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function MaterialsPage() {
  const [t, tCategory, locale] = await Promise.all([
    getTranslations("Materials"),
    getTranslations("MaterialCategory"),
    getLocale(),
  ]);

  const materials = await prisma.material.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/materiales/nuevo">
            <Plus className="size-4" />
            {t("add")}
          </Link>
        </Button>
      </div>

      {materials.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((material) => (
            <Card key={material.id} className="overflow-hidden rounded-2xl pt-0 shadow-sm">
              {material.photoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/files/${material.photoPath}`}
                  alt={material.name}
                  className="h-36 w-full object-cover"
                />
              ) : (
                <div className="flex h-36 w-full items-center justify-center bg-accent text-accent-foreground">
                  <Boxes className="size-8" />
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">
                    <span className="flex items-center gap-2">
                      {material.colorHex && (
                        <span
                          aria-label={t("fieldColor")}
                          className="inline-block size-3.5 shrink-0 rounded-full border"
                          style={{ backgroundColor: material.colorHex }}
                        />
                      )}
                      {material.name}
                    </span>
                  </CardTitle>
                  <Badge variant="secondary">{tCategory(material.category)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>
                    {t("inStock", { count: material.stock })} ·{" "}
                    {formatCents(material.priceCents, locale)}
                  </span>
                  {material.link && (
                    <a
                      href={material.link}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="transition-colors hover:text-foreground"
                      aria-label={t("fieldLink")}
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
                {(material.brand || material.fiberType || material.weight) && (
                  <p className="text-xs">
                    {[material.brand, material.fiberType, material.weight]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {material.location && (
                  <p className="flex items-center gap-1 text-xs">
                    <MapPin className="size-3" />
                    {material.location}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
