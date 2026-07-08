import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  emptyStandardizedPattern,
  parseStandardizedContent,
} from "@/lib/ai/standardize-pattern";
import { prisma } from "@/lib/prisma";
import { PatternEditor } from "./pattern-editor";

export default async function PatternEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [t, pattern] = await Promise.all([
    getTranslations("Patterns"),
    prisma.pattern.findUnique({
      where: { id },
      select: { id: true, title: true, standardizedContent: true },
    }),
  ]);

  if (!pattern) notFound();

  // Sin versión estandarizada (o corrupta) se parte de un esqueleto vacío:
  // el editor también sirve para escribir un patrón a mano.
  const initial =
    parseStandardizedContent(pattern.standardizedContent) ??
    emptyStandardizedPattern(pattern.title);

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/patrones/${pattern.id}`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {t("editorBack")}
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("editorTitle")}
        </h1>
        <p className="text-muted-foreground">
          {t("editorDescription", { title: pattern.title })}
        </p>
      </div>
      <PatternEditor id={pattern.id} initial={initial} />
    </div>
  );
}
