"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { SubmitButton } from "@/components/form/submit-button";
import { TagInput } from "@/components/form/tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { createPattern, updatePattern } from "./actions";

export type PatternFormValues = {
  id: string;
  title: string;
  externalUrl: string | null;
  filePath: string | null;
  coverImagePath: string | null;
  tags: { name: string }[];
};

export function PatternForm({
  pattern,
  suggestions = [],
}: {
  pattern?: PatternFormValues;
  suggestions?: string[];
}) {
  const t = useTranslations("Patterns");
  const tForms = useTranslations("Forms");
  const [state, formAction] = useActionState(
    pattern ? updatePattern : createPattern,
    null,
  );

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {pattern && <input type="hidden" name="id" value={pattern.id} />}

      <div className="space-y-2">
        <Label htmlFor="title">{t("fieldTitle")}</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={200}
          defaultValue={pattern?.title}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">
          {t("fieldFile")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        {pattern?.filePath && (
          <a
            href={`/api/files/${pattern.filePath}`}
            target="_blank"
            rel="noreferrer noopener"
            className="block text-sm text-primary hover:underline"
          >
            {t("viewFile")}
          </a>
        )}
        <Input
          id="file"
          name="file"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />
        <p className="text-xs text-muted-foreground">{t("fileHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="externalUrl">
          {t("fieldExternalUrl")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <Input
          id="externalUrl"
          name="externalUrl"
          type="url"
          placeholder="https://…"
          defaultValue={pattern?.externalUrl ?? undefined}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cover">
          {t("fieldCover")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        {pattern?.coverImagePath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/files/${pattern.coverImagePath}`}
            alt={pattern.title}
            className="size-20 rounded-lg border object-cover"
          />
        )}
        <Input id="cover" name="cover" type="file" accept="image/*" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">
          {tForms("tagsLabel")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <TagInput
          id="tags"
          suggestions={suggestions}
          defaultValue={pattern?.tags.map((tag) => tag.name)}
        />
        <p className="text-xs text-muted-foreground">{tForms("tagsHint")}</p>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <SubmitButton />
        <Button variant="outline" asChild>
          <Link href="/dashboard/patrones">{tForms("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
