"use client";

import { ChevronDown, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ChangeEvent, useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { standardizePatternManual } from "../actions";

function SubmitButton({ disabled, label }: { disabled?: boolean; label: string }) {
  const t = useTranslations("Patterns");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      <Sparkles className="size-4" />
      {pending ? t("standardizing") : label}
    </Button>
  );
}

/**
 * Estandarizar a partir de texto/imágenes pegados a mano, para cuando el
 * origen guardado del patrón falla o no da buen resultado.
 */
export function ManualStandardize({ id }: { id: string }) {
  const t = useTranslations("Patterns");
  const tForms = useTranslations("Forms");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(standardizePatternManual, null);
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function onPickImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    void (async () => {
      try {
        for (const file of files) {
          const body = new FormData();
          body.set("file", file);
          body.set("kind", "patterns");
          const res = await fetch("/api/uploads", { method: "POST", body });
          const data = (await res.json().catch(() => null)) as
            | { path?: string; error?: string }
            | null;
          if (res.ok && data?.path) {
            const path = data.path;
            setImagePaths((current) => [...current, path]);
          } else {
            setUploadError(data?.error ?? tForms("uploadFailed"));
          }
        }
      } finally {
        setUploading(false);
      }
    })();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        {t("manualStandardizeToggle")}
      </button>

      {open && (
        <form action={formAction} className="max-w-xl space-y-3 rounded-xl border p-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="imagePaths" value={JSON.stringify(imagePaths)} />

          <Textarea
            name="text"
            rows={4}
            placeholder={t("manualTextPlaceholder")}
          />

          {imagePaths.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {imagePaths.map((path) => (
                <div key={path} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/files/${path}`}
                    alt=""
                    className="size-16 rounded-lg border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setImagePaths((current) => current.filter((p) => p !== path))
                    }
                    aria-label={tForms("delete")}
                    className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onPickImages}
            aria-label={t("fieldImages")}
            className="text-sm"
          />

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

          <SubmitButton disabled={uploading} label={t("manualStandardizeSubmit")} />
        </form>
      )}
    </div>
  );
}
