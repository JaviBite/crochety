import { FilePlus2, Plus, ScrollText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { AssetImage, } from "@/components/asset-image";
import { assetUrl } from "@/lib/assets";
import { PatternCard, PatternSourceLinks } from "@/components/dashboard/cards";
import { AiStatusFilter } from "@/components/dashboard/ai-status-filter";
import { ListSearch } from "@/components/dashboard/list-search";
import { RowActions } from "@/components/dashboard/row-actions";
import { TagChips, TagFilter } from "@/components/dashboard/tag-filter";
import { ViewToggle } from "@/components/dashboard/view-toggle";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeSearch } from "@/lib/search";
import { parseView, viewCookieName } from "@/lib/view";
import { PATTERN_AI_STATUSES } from "@/lib/validations";
import { deletePattern } from "./actions";
import { AiStatusBadge } from "./ai-status-badge";

const BASE_PATH = "/dashboard/patrones";
const SECTION = "patrones";

export default async function PatternsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; q?: string; ai?: string }>;
}) {
  const { tag, q, ai } = await searchParams;
  const activeTag = tag?.toLowerCase();
  const search = normalizeSearch(q);
  const view = parseView(
    (await cookies()).get(viewCookieName(SECTION))?.value,
    "grid",
  );

  const filters: Prisma.PatternWhereInput[] = [];
  if (activeTag) filters.push({ tags: { some: { name: activeTag } } });
  if (search) {
    filters.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { tags: { some: { name: { contains: search, mode: "insensitive" } } } },
      ],
    });
  }
  // El estado viaja como String en BD: solo se filtra con valores conocidos.
  if (ai && (PATTERN_AI_STATUSES as readonly string[]).includes(ai)) {
    filters.push({ aiStatus: ai });
  }
  const hasFilters = filters.length > 0;

  const [t, patterns, filterTags] = await Promise.all([
    getTranslations("Patterns"),
    prisma.pattern.findMany({
      where: hasFilters ? { AND: filters } : undefined,
      orderBy: { createdAt: "desc" },
      // Select ligero: los listados no necesitan imagePaths ni el JSON
      // estandarizado (su presencia se deduce de aiStatus DONE/MULTIPLE).
      select: {
        id: true,
        title: true,
        aiStatus: true,
        coverImagePath: true,
        filePath: true,
        externalUrl: true,
        tags: { select: { name: true }, orderBy: { name: "asc" } },
      },
    }),
    prisma.tag.findMany({
      where: { patterns: { some: {} } },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  // El detalle de "¿tiene versión estandarizada?" sin arrastrar el JSON: los
  // escritores de standardizedContent siempre dejan aiStatus DONE o MULTIPLE.
  const toCard = (pattern: (typeof patterns)[number]) => ({
    ...pattern,
    hasStandardized: pattern.aiStatus === "DONE" || pattern.aiStatus === "MULTIPLE",
  });

  const preserve = { q: search, tag: activeTag, ai };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="h1-display">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/patrones/batch">
              <FilePlus2 className="size-4" />
              {t("addBatch")}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/patrones/nuevo">
              <Plus className="size-4" />
              {t("add")}
            </Link>
          </Button>
        </div>
      </div>

      {/* Toolbar compacta: búsqueda + vista + etiquetas. */}
      <div className="space-y-3 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <ListSearch className="min-w-56 flex-1" />
          {(patterns.length > 0 || hasFilters) && (
            <ViewToggle section={SECTION} value={view} />
          )}
        </div>
        {filterTags.length > 0 && (
          <TagFilter
            tags={filterTags.map((tag) => tag.name)}
            activeTag={activeTag}
            basePath={BASE_PATH}
            preserveQuery={preserve}
          />
        )}
        <AiStatusFilter active={ai} basePath={BASE_PATH} preserveQuery={preserve} />
      </div>

      {patterns.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-6" />}
          title={hasFilters ? t("noResultsTitle") : t("emptyTitle")}
          description={
            hasFilters ? t("noResultsDescription") : t("emptyDescription")
          }
        />
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {patterns.map((pattern) => (
            <PatternCard
              key={pattern.id}
              pattern={toCard(pattern)}
              deleteAction={deletePattern.bind(null, pattern.id)}
            />
          ))}
        </div>
      ) : (
        <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
          {patterns.map((pattern) => (
            <div key={pattern.id} className="flex items-center gap-3 p-3">
              <AssetImage
                src={pattern.coverImagePath ? assetUrl(pattern.coverImagePath) : null}
                alt={pattern.title}
                fallbackIcon={<ScrollText className="size-5" />}
                className="size-12 shrink-0 rounded-lg border object-cover"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    href={`${BASE_PATH}/${pattern.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {pattern.title}
                  </Link>
                  <AiStatusBadge status={pattern.aiStatus} />
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <PatternSourceLinks pattern={toCard(pattern)} />
                </div>
                <TagChips tags={pattern.tags} basePath={BASE_PATH} />
              </div>
              <RowActions
                viewHref={`${BASE_PATH}/${pattern.id}`}
                editHref={`${BASE_PATH}/editar/${pattern.id}`}
                deleteAction={deletePattern.bind(null, pattern.id)}
                entityName={pattern.title}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
