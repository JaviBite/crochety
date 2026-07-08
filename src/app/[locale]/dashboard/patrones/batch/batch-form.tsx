"use client";

import { CircleAlert, CircleCheck, LoaderCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ChangeEvent, useActionState, useState } from "react";
import { SubmitButton } from "@/components/form/submit-button";
import { TagInput } from "@/components/form/tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { createPatternsBatch } from "../actions";

type BatchFile = {
  key: string;
  fileName: string;
  /** Título editable, propuesto a partir del nombre del fichero. */
  title: string;
  /** Pathname devuelto por /api/uploads cuando la subida acaba bien. */
  path: string | null;
  error: string | null;
  uploading: boolean;
};

/** "mi-pulpo_azul.pdf" → "Mi pulpo azul". */
function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  const spaced = base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return spaced
    ? spaced.charAt(0).toUpperCase() + spaced.slice(1)
    : fileName;
}

/**
 * Alta de patrones en lote: cada fichero se sube a /api/uploads al elegirlo
 * (trampa #10: no viaja por la action) y la action recibe título + pathname
 * de cada uno. Las etiquetas se aplican a todos los patrones del lote.
 */
export function PatternBatchForm({
  suggestions = [],
}: {
  suggestions?: string[];
}) {
  const t = useTranslations("Patterns");
  const tForms = useTranslations("Forms");
  const [state, formAction] = useActionState(createPatternsBatch, null);
  const [files, setFiles] = useState<BatchFile[]>([]);

  function patchFile(key: string, patch: Partial<BatchFile>) {
    setFiles((current) =>
      current.map((file) => (file.key === key ? { ...file, ...patch } : file)),
    );
  }

  async function uploadOne(key: string, file: File) {
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("kind", "patterns");
      const res = await fetch("/api/uploads", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as
        | { path?: string; error?: string }
        | null;
      if (res.ok && data?.path) {
        patchFile(key, { uploading: false, path: data.path });
      } else {
        patchFile(key, {
          uploading: false,
          error: data?.error ?? tForms("uploadFailed"),
        });
      }
    } catch {
      patchFile(key, { uploading: false, error: tForms("uploadFailed") });
    }
  }

  function onPickFiles(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    if (picked.length === 0) return;
    const entries = picked.map((file) => ({
      key: crypto.randomUUID(),
      fileName: file.name,
      title: titleFromFileName(file.name),
      path: null,
      error: null,
      uploading: true,
    }));
    setFiles((current) => [...current, ...entries]);
    entries.forEach((entry, index) => void uploadOne(entry.key, picked[index]));
    event.target.value = "";
  }

  const ready = files.filter((file) => file.path);
  const uploading = files.some((file) => file.uploading);
  const serialized = JSON.stringify(
    ready.map((file) => ({ title: file.title.trim(), filePath: file.path })),
  );

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <input type="hidden" name="entries" value={serialized} />

      <div className="space-y-2">
        <Label htmlFor="files">{t("batchFilesLabel")}</Label>
        <Input
          id="files"
          type="file"
          multiple
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={onPickFiles}
        />
        <p className="text-xs text-muted-foreground">{t("batchFilesHint")}</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2 rounded-xl border p-4">
          {files.map((file) => (
            <div key={file.key} className="flex items-center gap-2">
              <span className="w-5 shrink-0">
                {file.uploading ? (
                  <LoaderCircle
                    className="size-4 animate-spin text-muted-foreground"
                    aria-label={tForms("uploading")}
                  />
                ) : file.error ? (
                  <CircleAlert
                    className="size-4 text-destructive"
                    aria-label={file.error}
                  />
                ) : (
                  <CircleCheck className="size-4 text-primary" />
                )}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <Input
                  aria-label={t("fieldTitle")}
                  value={file.title}
                  disabled={Boolean(file.error)}
                  onChange={(event) =>
                    patchFile(file.key, { title: event.target.value })
                  }
                />
                <p className="truncate text-xs text-muted-foreground">
                  {file.fileName}
                  {file.error && (
                    <span className="text-destructive"> · {file.error}</span>
                  )}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={tForms("delete")}
                className="text-muted-foreground hover:text-destructive"
                onClick={() =>
                  setFiles((current) =>
                    current.filter((entry) => entry.key !== file.key),
                  )
                }
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="tags">
          {tForms("tagsLabel")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <TagInput id="tags" suggestions={suggestions} />
        <p className="text-xs text-muted-foreground">{t("batchTagsHint")}</p>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton disabled={uploading || ready.length === 0} />
        <Button variant="outline" asChild>
          <Link href="/dashboard/patrones">{tForms("cancel")}</Link>
        </Button>
        {ready.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {t("batchReadyCount", { count: ready.length })}
          </span>
        )}
      </div>
    </form>
  );
}
