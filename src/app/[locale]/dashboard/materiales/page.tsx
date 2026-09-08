import { Boxes, Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { AssetImage, } from "@/components/asset-image";
import { assetUrl } from "@/lib/assets";
import {
  MaterialCard,
  MaterialLinkBadge,
} from "@/components/dashboard/cards";
import { ColorFilter } from "@/components/dashboard/color-filter";
import { ListSearch } from "@/components/dashboard/list-search";
import { RowActions } from "@/components/dashboard/row-actions";
import { TagChips, TagFilter } from "@/components/dashboard/tag-filter";
import { ViewToggle } from "@/components/dashboard/view-toggle";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { formatCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { colorFromParam, normalizeSearch, sortByColorSimilarity } from "@/lib/search";
import { parseView, viewCookieName } from "@/lib/view";
import { deleteMaterial } from "./actions";

const BASE_PATH = "/dashboard/materiales";
const SECTION = "materiales";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; q?: string; color?: string }>;
}) {
  const { tag, q, color } = await searchParams;
  const activeTag = tag?.toLowerCase();
  const search = normalizeSearch(q);
  const colorHex = colorFromParam(color);
  const view = parseView(
    (await cookies()).get(viewCookieName(SECTION))?.value,
    "grid",
  );

  const filters: Prisma.MaterialWhereInput[] = [];
  if (activeTag) filters.push({ tags: { some: { name: activeTag } } });
  if (search) {
    filters.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { fiberType: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  const hasFilters = filters.length > 0 || Boolean(colorHex);

  const [t, tCategory, locale, materials, filterTags, colorRows] =
    await Promise.all([
      getTranslations("Materials"),
      getTranslations("MaterialCategory"),
      getLocale(),
      prisma.material.findMany({
        where: hasFilters ? { AND: filters } : undefined,
        orderBy: { createdAt: "desc" },
        include: { tags: { select: { name: true }, orderBy: { name: "asc" } } },
      }),
      prisma.tag.findMany({
        where: { materials: { some: {} } },
        orderBy: { name: "asc" },
        select: { name: true },
      }),
      prisma.material.findMany({
        where: { colorHex: { not: null } },
        distinct: ["colorHex"],
        orderBy: { colorHex: "asc" },
        select: { colorHex: true },
      }),
    ]);

  const materialsBySimilarity = sortByColorSimilarity(materials, colorHex);

  // Filtros a conservar en los enlaces de tag/color (no perder la búsqueda).
  const preserve = { q: search, tag: activeTag, color };
  const colors = colorRows
    .map((row) => row.colorHex)
    .filter((hex): hex is string => hex != null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="h1-display">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/materiales/nuevo">
            <Plus className="size-4" />
            {t("add")}
          </Link>
        </Button>
      </div>

      {/* Toolbar compacta: búsqueda + vista + etiquetas + colores. */}
      <div className="space-y-3 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <ListSearch className="min-w-56 flex-1" />
          {(materialsBySimilarity.length > 0 || hasFilters) && (
            <ViewToggle section={SECTION} value={view} />
          )}
        </div>
        {(filterTags.length > 0 || colors.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-2">
            <TagFilter
              tags={filterTags.map((tag) => tag.name)}
              activeTag={activeTag}
              basePath={BASE_PATH}
              preserveQuery={preserve}
            />
            <ColorFilter
              colors={colors}
              activeColor={color}
              basePath={BASE_PATH}
              preserveQuery={preserve}
            />
          </div>
        )}
      </div>

      {materialsBySimilarity.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-6" />}
          title={hasFilters ? t("noResultsTitle") : t("emptyTitle")}
          description={
            hasFilters ? t("noResultsDescription") : t("emptyDescription")
          }
        />
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {materialsBySimilarity.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              deleteAction={deleteMaterial.bind(null, material.id)}
              locale={locale}
            />
          ))}
        </div>
      ) : (
        <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
          {materialsBySimilarity.map((material) => (
            <div key={material.id} className="flex items-center gap-3 p-3">
              <AssetImage
                src={material.photoPath ? assetUrl(material.photoPath) : null}
                alt={material.name}
                fallbackColor={material.colorHex}
                fallbackIcon={<Boxes className="size-5" />}
                className="size-12 shrink-0 rounded-lg border object-cover"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {material.colorHex && (
                    <span
                      aria-label={t("fieldColor")}
                      className="inline-block size-3.5 shrink-0 rounded-full border"
                      style={{ backgroundColor: material.colorHex }}
                    />
                  )}
                  <span className="font-medium text-foreground">
                    {material.name}
                  </span>
                  <Badge variant="secondary">
                    {tCategory(material.category)}
                  </Badge>
                  {material.link && (
                    <MaterialLinkBadge
                      href={material.link}
                      label={t("fieldLink")}
                    />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("inStock", { count: material.stock })} ·{" "}
                  {formatCents(material.priceCents, locale)}
                </p>
                <TagChips tags={material.tags} basePath={BASE_PATH} />
              </div>
              <RowActions
                viewHref={`${BASE_PATH}/${material.id}`}
                editHref={`${BASE_PATH}/editar/${material.id}`}
                deleteAction={deleteMaterial.bind(null, material.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
