"use client";

import { ArrowDown, ArrowUp, ListOrdered, Plus, StickyNote, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type StandardizedPattern,
} from "@/lib/ai/standardize-pattern.shared";
import { NONE_VALUE } from "@/lib/forms";

type Section = StandardizedPattern["sections"][number];
type Round = Section["rounds"][number];

const DIFFICULTIES = ["principiante", "intermedio", "avanzado"] as const;
const LANGUAGES = ["es", "en"] as const;

function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/**
 * Campos del editor de patrón estandarizado: mismo contrato que produce la IA,
 * editable campo a campo (metadatos, materiales, abreviaturas, secciones con
 * rondas y pasos intercalados, montaje). Puro: sin form ni persistencia, para
 * reutilizarse tanto en el patrón guardado como en el convertidor efímero.
 * setDoc acepta un updater estilo React: `setDoc((current) => ...)`.
 */
export function PatternEditorFields({
  doc,
  setDoc,
}: {
  doc: StandardizedPattern;
  setDoc: (
    updater: (current: StandardizedPattern) => StandardizedPattern,
  ) => void;
}) {
  const t = useTranslations("Patterns");
  const tForms = useTranslations("Forms");
  const tDifficulty = useTranslations("PatternDifficulty");
  const tLanguage = useTranslations("PatternLanguage");

  function update<K extends keyof StandardizedPattern>(
    key: K,
    value: StandardizedPattern[K],
  ) {
    setDoc((current) => ({ ...current, [key]: value }));
  }

  function updateSection(index: number, patch: Partial<Section>) {
    update(
      "sections",
      doc.sections.map((section, i) =>
        i === index ? { ...section, ...patch } : section,
      ),
    );
  }

  function updateRound(
    sectionIndex: number,
    roundIndex: number,
    patch: Partial<Round>,
  ) {
    updateSection(sectionIndex, {
      rounds: doc.sections[sectionIndex].rounds.map((round, i) =>
        i === roundIndex ? { ...round, ...patch } : round,
      ),
    });
  }

  return (
    <div className="space-y-6">
      {/* Metadatos */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t("editorMetaTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-title">{t("fieldTitle")}</Label>
            <Input
              id="doc-title"
              required
              maxLength={200}
              value={doc.title}
              onChange={(event) => update("title", event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="doc-language">{t("metaLanguage")}</Label>
              <Select
                value={doc.language}
                onValueChange={(value) =>
                  update("language", value as StandardizedPattern["language"])
                }
              >
                <SelectTrigger id="doc-language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((language) => (
                    <SelectItem key={language} value={language}>
                      {tLanguage(language)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-difficulty">{t("metaDifficulty")}</Label>
              <Select
                value={doc.difficulty ?? NONE_VALUE}
                onValueChange={(value) =>
                  update(
                    "difficulty",
                    value === NONE_VALUE
                      ? null
                      : (value as StandardizedPattern["difficulty"]),
                  )
                }
              >
                <SelectTrigger id="doc-difficulty" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>{tForms("none")}</SelectItem>
                  {DIFFICULTIES.map((difficulty) => (
                    <SelectItem key={difficulty} value={difficulty}>
                      {tDifficulty(difficulty)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-hook">{t("metaHookMm")}</Label>
              <Input
                id="doc-hook"
                type="number"
                min={0}
                step="0.25"
                value={doc.hookSizeMm ?? ""}
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  update("hookSizeMm", Number.isFinite(value) ? value : null);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Materiales */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("materialsTitle")}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => update("materials", [...doc.materials, ""])}
          >
            <Plus className="size-4" />
            {t("editorAddMaterial")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {doc.materials.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("editorEmptyList")}
            </p>
          )}
          {doc.materials.map((material, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                aria-label={t("editorMaterialLabel", { index: index + 1 })}
                value={material}
                onChange={(event) =>
                  update(
                    "materials",
                    doc.materials.map((m, i) =>
                      i === index ? event.target.value : m,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={tForms("delete")}
                className="text-muted-foreground hover:text-destructive"
                onClick={() =>
                  update(
                    "materials",
                    doc.materials.filter((_, i) => i !== index),
                  )
                }
              >
                <X />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Abreviaturas */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("abbreviationsTitle")}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              update("abbreviations", [
                ...doc.abbreviations,
                { abbr: "", meaning: "" },
              ])
            }
          >
            <Plus className="size-4" />
            {t("editorAddAbbreviation")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {doc.abbreviations.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("editorEmptyList")}
            </p>
          )}
          {doc.abbreviations.map((abbreviation, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                className="w-24"
                aria-label={t("colAbbr")}
                placeholder={t("colAbbr")}
                value={abbreviation.abbr}
                onChange={(event) =>
                  update(
                    "abbreviations",
                    doc.abbreviations.map((a, i) =>
                      i === index ? { ...a, abbr: event.target.value } : a,
                    ),
                  )
                }
              />
              <Input
                className="min-w-0 flex-1"
                aria-label={t("colMeaning")}
                placeholder={t("colMeaning")}
                value={abbreviation.meaning}
                onChange={(event) =>
                  update(
                    "abbreviations",
                    doc.abbreviations.map((a, i) =>
                      i === index ? { ...a, meaning: event.target.value } : a,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={tForms("delete")}
                className="text-muted-foreground hover:text-destructive"
                onClick={() =>
                  update(
                    "abbreviations",
                    doc.abbreviations.filter((_, i) => i !== index),
                  )
                }
              >
                <X />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Secciones con sus rondas y pasos */}
      {doc.sections.map((section, sectionIndex) => (
        <Card key={sectionIndex} className="rounded-2xl shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Input
                className="min-w-0 flex-1 font-medium"
                aria-label={t("editorSectionName")}
                placeholder={t("editorSectionPlaceholder")}
                value={section.name}
                onChange={(event) =>
                  updateSection(sectionIndex, { name: event.target.value })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("editorMoveUp")}
                disabled={sectionIndex === 0}
                onClick={() =>
                  update(
                    "sections",
                    moveItem(doc.sections, sectionIndex, sectionIndex - 1),
                  )
                }
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("editorMoveDown")}
                disabled={sectionIndex === doc.sections.length - 1}
                onClick={() =>
                  update(
                    "sections",
                    moveItem(doc.sections, sectionIndex, sectionIndex + 1),
                  )
                }
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("editorRemoveSection")}
                className="text-muted-foreground hover:text-destructive"
                onClick={() =>
                  update(
                    "sections",
                    doc.sections.filter((_, i) => i !== sectionIndex),
                  )
                }
              >
                <X />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {section.rounds.map((round, roundIndex) => {
              const isStep = round.kind === "step";
              return (
                <div key={roundIndex} className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={
                      isStep ? t("editorMarkAsRound") : t("editorMarkAsStep")
                    }
                    title={
                      isStep ? t("editorMarkAsRound") : t("editorMarkAsStep")
                    }
                    className={
                      isStep ? "text-primary" : "text-muted-foreground"
                    }
                    onClick={() =>
                      updateRound(sectionIndex, roundIndex, {
                        kind: isStep ? undefined : "step",
                        stitchCount: isStep ? round.stitchCount : null,
                      })
                    }
                  >
                    {isStep ? <StickyNote /> : <ListOrdered />}
                  </Button>
                  <Input
                    className="w-20 shrink-0"
                    aria-label={t("colRound")}
                    placeholder={isStep ? "Paso" : "R1"}
                    value={round.label}
                    onChange={(event) =>
                      updateRound(sectionIndex, roundIndex, {
                        label: event.target.value,
                      })
                    }
                  />
                  <Input
                    className="min-w-0 flex-1"
                    aria-label={t("colInstruction")}
                    placeholder={t("editorInstructionPlaceholder")}
                    value={round.instruction}
                    onChange={(event) =>
                      updateRound(sectionIndex, roundIndex, {
                        instruction: event.target.value,
                      })
                    }
                  />
                  {!isStep && (
                    <Input
                      className="w-20 shrink-0"
                      type="number"
                      min={0}
                      aria-label={t("colStitches")}
                      value={round.stitchCount ?? ""}
                      onChange={(event) => {
                        const value = Number.parseInt(event.target.value, 10);
                        updateRound(sectionIndex, roundIndex, {
                          stitchCount: Number.isFinite(value) ? value : null,
                        });
                      }}
                    />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("editorMoveUp")}
                    disabled={roundIndex === 0}
                    onClick={() =>
                      updateSection(sectionIndex, {
                        rounds: moveItem(
                          section.rounds,
                          roundIndex,
                          roundIndex - 1,
                        ),
                      })
                    }
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("editorMoveDown")}
                    disabled={roundIndex === section.rounds.length - 1}
                    onClick={() =>
                      updateSection(sectionIndex, {
                        rounds: moveItem(
                          section.rounds,
                          roundIndex,
                          roundIndex + 1,
                        ),
                      })
                    }
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("editorRemoveRound")}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      updateSection(sectionIndex, {
                        rounds: section.rounds.filter((_, i) => i !== roundIndex),
                      })
                    }
                  >
                    <X />
                  </Button>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateSection(sectionIndex, {
                    rounds: [
                      ...section.rounds,
                      { label: "", instruction: "", stitchCount: null },
                    ],
                  })
                }
              >
                <Plus className="size-4" />
                {t("editorAddRound")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateSection(sectionIndex, {
                    rounds: [
                      ...section.rounds,
                      {
                        label: "",
                        instruction: "",
                        stitchCount: null,
                        kind: "step",
                      },
                    ],
                  })
                }
              >
                <StickyNote className="size-4" />
                {t("editorAddStep")}
              </Button>
            </div>
            <div className="space-y-2 pt-1">
              <Label htmlFor={`section-notes-${sectionIndex}`}>
                {t("sectionNotesLabel")}{" "}
                <span className="text-muted-foreground">
                  ({tForms("optional")})
                </span>
              </Label>
              <Textarea
                id={`section-notes-${sectionIndex}`}
                rows={2}
                value={section.notes ?? ""}
                onChange={(event) =>
                  updateSection(sectionIndex, {
                    notes: event.target.value || null,
                  })
                }
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          update("sections", [
            ...doc.sections,
            { name: "", rounds: [], notes: null },
          ])
        }
      >
        <Plus className="size-4" />
        {t("editorAddSection")}
      </Button>

      {/* Montaje y acabado */}
      <div className="space-y-2">
        <Label htmlFor="doc-assembly">
          {t("assemblyTitle")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <Textarea
          id="doc-assembly"
          rows={3}
          value={doc.assemblyNotes ?? ""}
          onChange={(event) =>
            update("assemblyNotes", event.target.value || null)
          }
        />
      </div>
    </div>
  );
}
