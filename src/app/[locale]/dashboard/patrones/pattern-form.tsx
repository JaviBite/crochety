"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { discardUploadAction } from "@/app/[locale]/dashboard/discard-upload";
import { assetUrl } from "@/lib/assets";
import { FileField } from "@/components/form/file-field";
import { FormFooter } from "@/components/form/form-footer";
import { PhotoChip } from "@/components/form/photo-chip";
import { SubmitButton } from "@/components/form/submit-button";
import { TagInput } from "@/components/form/tag-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { uploadPatternFile } from "@/lib/pattern-upload";
import { createPattern, updatePattern } from "./actions";

export type PatternFormValues = {
  id: string;
  title: string;
  externalUrl: string | null;
  filePath: string | null;
  imagePaths: string[];
  coverImagePath: string | null;
  tags: { name: string }[];
  autoSplit: boolean;
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
  // La portada parte de la guardada: quitarla envía "" y la action la limpia
  // (igual que la foto del pedido). Una subida nueva descartada con la X es
  // huérfano: se borra del storage al instante (la guardada, al guardar).
  const [coverPath, setCoverPath] = useState<string | null>(
    pattern?.coverImagePath ?? null,
  );
  const [imagePaths, setImagePaths] = useState<string[]>(
    pattern?.imagePaths ?? [],
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /** Subida descartada de esta sesión (≠ guardada): no está en BD, huérfano. */
  function discardIfNew(
    path: string | null | undefined,
    initial: string | null | undefined,
  ) {
    if (path && path !== initial) void discardUploadAction(path);
  }

  // Varias imágenes como origen del patrón: la IA las lee por visión.
  function uploadImages(files: File[]) {
    if (files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    void (async () => {
      try {
        for (const file of files) {
          const result = await uploadPatternFile(file);
          if ("path" in result) {
            const path = result.path;
            setImagePaths((current) => [...current, path]);
          } else {
            setUploadError(result.error ?? tForms("uploadFailed"));
          }
        }
      } catch {
        setUploadError(tForms("uploadFailed"));
      } finally {
        setUploading(false);
      }
    })();
  }

  function uploadOne(file: File, onDone: (path: string) => void) {
    setUploadError(null);
    setUploading(true);
    void (async () => {
      try {
        const result = await uploadPatternFile(file);
        if ("path" in result) {
          onDone(result.path);
        } else {
          setUploadError(result.error ?? tForms("uploadFailed"));
        }
      } catch {
        setUploadError(tForms("uploadFailed"));
      } finally {
        setUploading(false);
      }
    })();
  }

  const shownFilePath = filePath ?? pattern?.filePath ?? null;

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {pattern && <input type="hidden" name="id" value={pattern.id} />}
      <input type="hidden" name="filePath" value={filePath ?? ""} />
      <input type="hidden" name="coverPath" value={coverPath ?? ""} />
      <input
        type="hidden"
        name="imagePaths"
        value={JSON.stringify(imagePaths)}
      />

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
        <FileField
          id="file"
          accept=".pdf,.docx,.html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html"
          hint={t("fileHint")}
          onFiles={(files) => {
            const file = files[0];
            if (file)
              uploadOne(file, (path) => {
                discardIfNew(filePath, pattern?.filePath);
                setFilePath(path);
              });
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="images">
          {t("fieldImages")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        {imagePaths.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {imagePaths.map((path) => (
              <PhotoChip
                key={path}
                src={assetUrl(path)}
                onDelete={() => {
                  discardIfNew(path, pattern?.imagePaths.includes(path) ? path : null);
                  setImagePaths((current) =>
                    current.filter((entry) => entry !== path),
                  );
                }}
              />
            ))}
          </div>
        )}
        <FileField
          id="images"
          accept="image/*"
          multiple
          hint={t("imagesHint")}
          onFiles={uploadImages}
        />
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
        {coverPath && (
          <div className="mb-2">
            <PhotoChip
              src={assetUrl(coverPath)}
              size="size-20"
              onDelete={() => {
                discardIfNew(coverPath, pattern?.coverImagePath);
                setCoverPath(null);
              }}
            />
          </div>
        )}
        <FileField
          id="cover"
          accept="image/*"
          hint={t("coverHint")}
          onFiles={(files) => {
            const file = files[0];
            if (file) uploadOne(file, setCoverPath);
          }}
        />
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

      <div className="flex items-start gap-2 space-y-0">
        <Checkbox
          id="autoSplit"
          name="autoSplit"
          defaultChecked={pattern?.autoSplit ?? false}
          className="mt-1"
        />
        <div className="space-y-1">
          <Label htmlFor="autoSplit" className="cursor-pointer font-normal">
            {t("autoSplitLabel")}
          </Label>
          <p className="text-xs text-muted-foreground">{t("autoSplitHint")}</p>
        </div>
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

      <FormFooter>
        {uploading && (
          <p className="self-center text-sm text-muted-foreground">
            {tForms("uploading")}
          </p>
        )}
        <SubmitButton disabled={uploading} />
        <Button variant="outline" asChild>
          <Link href="/dashboard/patrones">{tForms("cancel")}</Link>
        </Button>
      </FormFooter>
    </form>
  );
}
