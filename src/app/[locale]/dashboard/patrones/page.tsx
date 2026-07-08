import { ExternalLink, FilePlus2, FileText, Plus, ScrollText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { ListSearch } from "@/components/dashboard/list-search";
import { RowActions } from "@/components/dashboard/row-actions";
import { TagChips, TagFilter } from "@/components/dashboard/tag-filter";
import { ViewToggle } from "@/components/dashboard/view-toggle";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeSearch } from "@/lib/search";
import { parseView, viewCookieName } from "@/lib/view";
import { deletePattern } from "./actions";
import { AiStatusBadge } from "./ai-status-badge";

const BASE_PATH = "/dashboard/patrones";
const SECTION = "patrones";

export default async function PatternsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; q?: string }>;
}) {
  const { tag, q } = await searchParams;
  const activeTag = tag?.toLowerCase();
  const search = normalizeSearch(q);
  const view = parseView(
    (await cookies()).get(viewCookieName(SECTION))?.value,
    "grid",
  );

  const filters: Prisma.PatternWhereInput[] = [];
  if (activeTag) filters.push({ tags: { some: { name: activeTag } } });
  if (search) filters.push({ title: { contains: search, mode: "insensitive" } });
  const hasFilters = filters.length > 0;

  const [t, patterns, filterTags] = await Promise.all([
    getTranslations("Patterns"),
    prisma.pattern.findMany({
      where: hasFilters ? { AND: filters } : undefined,
      orderBy: { createdAt: "desc" },
      include: { tags: { select: { name: true }, orderBy: { name: "asc" } } },
    }),
    prisma.tag.findMany({
      where: { patterns: { some: {} } },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  const preserve = { q: search, tag: activeTag };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
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

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <ListSearch className="min-w-56 flex-1" />
          {(patterns.length > 0 || hasFilters) && (
            <ViewToggle section={SECTION} value={view} />
          )}
        </div>
        <TagFilter
          tags={filterTags.map((tag) => tag.name)}
          activeTag={activeTag}
          basePath={BASE_PATH}
          preserveQuery={preserve}
        />
      </div>

      {patterns.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={hasFilters ? t("noResultsTitle") : t("emptyTitle")}
          description={
            hasFilters ? t("noResultsDescription") : t("emptyDescription")
          }
        />
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {patterns.map((pattern) => (
            <Card key={pattern.id} className="overflow-hidden rounded-2xl pt-0 shadow-sm">
              {pattern.coverImagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/files/${pattern.coverImagePath}`}
                  alt={pattern.title}
                  className="h-36 w-full object-cover"
                />
              ) : (
                <div className="flex h-36 w-full items-center justify-center bg-accent text-accent-foreground">
                  <ScrollText className="size-8" />
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">
                    <Link
                      href={`${BASE_PATH}/${pattern.id}`}
                      className="hover:underline"
                    >
                      {pattern.title}
                    </Link>
                  </CardTitle>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <AiStatusBadge status={pattern.aiStatus} />
                    <RowActions
                      editHref={`${BASE_PATH}/editar/${pattern.id}`}
                      deleteAction={deletePattern.bind(null, pattern.id)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  {pattern.filePath && (
                    <a
                      href={`/api/files/${pattern.filePath}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-1 transition-colors hover:text-foreground"
                    >
                      <FileText className="size-3.5" />
                      {t("viewFile")}
                    </a>
                  )}
                  {pattern.externalUrl && (
                    <a
                      href={pattern.externalUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-1 transition-colors hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5" />
                      {t("viewLink")}
                    </a>
                  )}
                  {!pattern.filePath && !pattern.externalUrl && (
                    <span className="text-xs">{t("noSource")}</span>
                  )}
                </div>
                <TagChips tags={pattern.tags} basePath={BASE_PATH} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
          {patterns.map((pattern) => (
            <div key={pattern.id} className="flex items-center gap-3 p-3">
              {pattern.coverImagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/files/${pattern.coverImagePath}`}
                  alt={pattern.title}
                  className="size-12 shrink-0 rounded-lg border object-cover"
                />
              ) : (
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <ScrollText className="size-5" />
                </span>
              )}
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
                  {pattern.filePath && (
                    <a
                      href={`/api/files/${pattern.filePath}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-1 transition-colors hover:text-foreground"
                    >
                      <FileText className="size-3.5" />
                      {t("viewFile")}
                    </a>
                  )}
                  {pattern.externalUrl && (
                    <a
                      href={pattern.externalUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-1 transition-colors hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5" />
                      {t("viewLink")}
                    </a>
                  )}
                  {!pattern.filePath && !pattern.externalUrl && (
                    <span className="text-xs">{t("noSource")}</span>
                  )}
                </div>
                <TagChips tags={pattern.tags} basePath={BASE_PATH} />
              </div>
              <RowActions
                editHref={`${BASE_PATH}/editar/${pattern.id}`}
                deleteAction={deletePattern.bind(null, pattern.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
