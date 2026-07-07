"use client";

import { useTranslations } from "next-intl";
import { type ChangeEvent, useActionState, useState } from "react";
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

  // Los ficheros se suben a /api/uploads al elegirlos (el body de las server
  // actions está limitado a 1 MB); la action solo recibe los pathnames.
  const [filePath, setFilePath] = useState<string | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function onPickUpload(
    event: ChangeEvent<HTMLInputElement>,
    onDone: (path: string) => void,
  ) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    void (async () => {
      try {
        const body = new FormData();
        body.set("file", file);
        body.set("kind", "patterns");
        const res = await fetch("/api/uploads", { method: "POST", body });
        const data = (await res.json().catch(() => null)) as
          | { path?: string; error?: string }
          | null;
        if (res.ok && data?.path) {
          onDone(data.path);
        } else {
          input.value = "";
          setUploadError(data?.error ?? tForms("uploadFailed"));
        }
      } catch {
        input.value = "";
        setUploadError(tForms("uploadFailed"));
      } finally {
        setUploading(false);
      }
    })();
  }

  const shownFilePath = filePath ?? pattern?.filePath ?? null;
  const shownCoverPath = coverPath ?? pattern?.coverImagePath ?? null;

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {pattern && <input type="hidden" name="id" value={pattern.id} />}
      <input type="hidden" name="filePath" value={filePath ?? ""} />
      <input type="hidden" name="coverPath" value={coverPath ?? ""} />

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
        {shownFilePath && (
          <a
            href={`/api/files/${shownFilePath}`}
            target="_blank"
            rel="noreferrer noopener"
            className="block text-sm text-primary hover:underline"
          >
            {t("viewFile")}
          </a>
        )}
        <Input
          id="file"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => onPickUpload(event, setFilePath)}
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
        {shownCoverPath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/files/${shownCoverPath}`}
            alt={pattern?.title ?? ""}
            className="size-20 rounded-lg border object-cover"
          />
        )}
        <Input
          id="cover"
          type="file"
          accept="image/*"
          onChange={(event) => onPickUpload(event, setCoverPath)}
        />
        <p className="text-xs text-muted-foreground">{t("coverHint")}</p>
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

      {uploadError && (
        <p role="alert" className="text-sm text-destructive">
          {uploadError}
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        {uploading && (
          <p className="self-center text-sm text-muted-foreground">
            {tForms("uploading")}
          </p>
        )}
        <SubmitButton disabled={uploading} />
        <Button variant="outline" asChild>
          <Link href="/dashboard/patrones">{tForms("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
