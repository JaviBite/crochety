import {
  ArrowLeft,
  ExternalLink,
  FileText,
  NotebookPen,
  Pencil,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { TagChips } from "@/components/dashboard/tag-filter";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import {
  parseStandardizedContent,
  type StandardizedPattern,
} from "@/lib/ai/standardize-pattern";
import { parseImagePaths } from "@/lib/pattern-source";
import { prisma } from "@/lib/prisma";
import type { PatternAiStatus } from "@/lib/validations";
import { AiStatusBadge } from "../ai-status-badge";
import { CoverPicker } from "./cover-picker";
import { ManualStandardize } from "./manual-standardize";
import { StandardizeButton } from "./standardize-button";

const BASE_PATH = "/dashboard/patrones";

export default async function PatternDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [t, tDifficulty, tLanguage, pattern] = await Promise.all([
    getTranslations("Patterns"),
    getTranslations("PatternDifficulty"),
    getTranslations("PatternLanguage"),
    prisma.pattern.findUnique({
      where: { id },
      include: { tags: { select: { name: true }, orderBy: { name: "asc" } } },
    }),
  ]);

  if (!pattern) notFound();

  const standardized = parseStandardizedContent(pattern.standardizedContent);
  const hasSource = Boolean(
    pattern.filePath ||
      pattern.externalUrl ||
      parseImagePaths(pattern.imagePaths).length,
  );
  const aiStatus = pattern.aiStatus as PatternAiStatus;

  return (
    <div className="space-y-6">
      <Link
        href={BASE_PATH}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {t("detailBack")}
      </Link>

      {/* Cabecera */}
      <div className="flex flex-wrap items-start gap-4">
        {pattern.coverImagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/files/${pattern.coverImagePath}`}
            alt={pattern.title}
            className="size-24 rounded-2xl border object-cover"
          />
        ) : (
          <span className="flex size-24 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <ScrollText className="size-8" />
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {pattern.title}
            </h1>
            <AiStatusBadge status={pattern.aiStatus} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
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
            {!hasSource && <span className="text-xs">{t("noSource")}</span>}
          </div>
          <TagChips tags={pattern.tags} basePath={BASE_PATH} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`${BASE_PATH}/editar/${pattern.id}`}>
              <Pencil className="size-4" />
              {t("editTitle")}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`${BASE_PATH}/${pattern.id}/editor`}>
              <NotebookPen className="size-4" />
              {t("editContent")}
            </Link>
          </Button>
        </div>
      </div>

      <StandardizeButton id={pattern.id} aiStatus={aiStatus} hasSource={hasSource} />
      <ManualStandardize id={pattern.id} />

      {hasSource && <CoverPicker id={pattern.id} />}

      {standardized ? (
        <StandardizedView
          standardized={standardized}
          labels={{
            language: t("metaLanguage"),
            languageValue: tLanguage(standardized.language),
            difficulty: t("metaDifficulty"),
            difficultyValue: standardized.difficulty
              ? tDifficulty(standardized.difficulty)
              : null,
            hook: t("metaHook"),
            hookValue:
              standardized.hookSizeMm != null
                ? t("hookMm", { size: standardized.hookSizeMm })
                : null,
            materials: t("materialsTitle"),
            abbreviations: t("abbreviationsTitle"),
            colAbbr: t("colAbbr"),
            colMeaning: t("colMeaning"),
            colRound: t("colRound"),
            colInstruction: t("colInstruction"),
            colStitches: t("colStitches"),
            notes: t("sectionNotesLabel"),
            assembly: t("assemblyTitle"),
          }}
        />
      ) : aiStatus === "PENDING" || aiStatus === "PROCESSING" ? (
        <EmptyState
          icon={Sparkles}
          title={t("standardizedEmptyTitle")}
          description={t("standardizedProcessing")}
        />
      ) : (
        <EmptyState
          icon={Sparkles}
          title={t("standardizedEmptyTitle")}
          description={t("standardizedEmptyDescription")}
        />
      )}
    </div>
  );
}

function StandardizedView({
  standardized,
  labels,
}: {
  standardized: StandardizedPattern;
  labels: Record<string, string | null>;
}) {
  return (
    <div className="space-y-5">
      {/* Metadatos */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">
          {labels.language}: {labels.languageValue}
        </Badge>
        {labels.difficultyValue && (
          <Badge variant="secondary">
            {labels.difficulty}: {labels.difficultyValue}
          </Badge>
        )}
        {labels.hookValue && (
          <Badge variant="secondary">
            {labels.hook}: {labels.hookValue}
          </Badge>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {standardized.materials.length > 0 && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{labels.materials}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {standardized.materials.map((material) => (
                  <li key={material}>{material}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {standardized.abbreviations.length > 0 && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{labels.abbreviations}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{labels.colAbbr}</TableHead>
                    <TableHead>{labels.colMeaning}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standardized.abbreviations.map((abbr) => (
                    <TableRow key={abbr.abbr}>
                      <TableCell className="font-medium">{abbr.abbr}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {abbr.meaning}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Secciones con sus rondas */}
      {standardized.sections.map((section) => (
        <Card key={section.name} className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{section.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">{labels.colRound}</TableHead>
                  <TableHead>{labels.colInstruction}</TableHead>
                  <TableHead className="w-20 text-right">
                    {labels.colStitches}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.rounds.map((round) => (
                  <TableRow key={round.label}>
                    <TableCell className="font-medium">{round.label}</TableCell>
                    <TableCell className="whitespace-normal">
                      {round.instruction}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {round.stitchCount ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {section.notes && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {labels.notes}:
                </span>{" "}
                {section.notes}
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {standardized.assemblyNotes && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{labels.assembly}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {standardized.assemblyNotes}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
