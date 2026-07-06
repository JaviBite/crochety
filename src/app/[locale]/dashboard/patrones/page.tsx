import { ExternalLink, FileText, Plus, ScrollText } from "lucide-react";
import { getTranslations } from "next-intl/server";
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
import { prisma } from "@/lib/prisma";
import type { PatternAiStatus } from "@/lib/validations";

const AI_STATUS_CLASSES: Record<PatternAiStatus, string> = {
  NONE: "bg-muted text-muted-foreground",
  PENDING: "bg-accent text-accent-foreground",
  PROCESSING: "bg-accent text-accent-foreground",
  DONE: "bg-primary/15 text-primary",
  ERROR: "bg-destructive/15 text-destructive",
};

export default async function PatternsPage() {
  const [t, tAiStatus] = await Promise.all([
    getTranslations("Patterns"),
    getTranslations("PatternAiStatus"),
  ]);

  const patterns = await prisma.pattern.findMany({
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
          <Link href="/dashboard/patrones/nuevo">
            <Plus className="size-4" />
            {t("add")}
          </Link>
        </Button>
      </div>

      {patterns.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
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
                    {pattern.title}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={`border-transparent ${AI_STATUS_CLASSES[pattern.aiStatus as PatternAiStatus] ?? ""}`}
                  >
                    {tAiStatus(pattern.aiStatus)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
