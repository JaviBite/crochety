"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  normalizeStandardizedPattern,
  type StandardizedPattern,
} from "@/lib/ai/standardize-pattern.shared";
import { updatePatternContent } from "../../actions";
import { PatternEditorFields } from "./pattern-editor-fields";

/** Limpia filas vacías antes de serializar (el contrato no las necesita). */
function cleaned(doc: StandardizedPattern): StandardizedPattern {
  return normalizeStandardizedPattern({
    ...doc,
    title: doc.title.trim(),
    materials: doc.materials.map((m) => m.trim()).filter(Boolean),
    abbreviations: doc.abbreviations
      .map((a) => ({ abbr: a.abbr.trim(), meaning: a.meaning.trim() }))
      .filter((a) => a.abbr || a.meaning),
    sections: doc.sections
      .map((section) => ({
        name: section.name.trim(),
        notes: section.notes?.trim() || null,
        rounds: section.rounds.filter(
          (round) => round.label.trim() || round.instruction.trim(),
        ),
      }))
      .filter((section) => section.name || section.rounds.length > 0),
    assemblyNotes: doc.assemblyNotes?.trim() || null,
  });
}

/**
 * Editor online del patrón estandarizado guardado: serializa el documento
 * editado y lo persiste vía server action (revalidado contra el contrato).
 */
export function PatternEditor({
  id,
  initial,
}: {
  id: string;
  initial: StandardizedPattern;
}) {
  const tForms = useTranslations("Forms");
  const [state, formAction] = useActionState(updatePatternContent, null);
  const [doc, setDoc] = useState<StandardizedPattern>(initial);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden"
        name="content"
        value={JSON.stringify(cleaned(doc))}
      />

      <PatternEditorFields doc={doc} setDoc={setDoc} />

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <SubmitButton />
        <Button variant="outline" asChild>
          <Link href={`/dashboard/patrones/${id}`}>{tForms("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
