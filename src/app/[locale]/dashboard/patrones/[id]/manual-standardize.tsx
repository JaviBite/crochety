"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { assetUrl } from "@/lib/assets";
import { FileField } from "@/components/form/file-field";
import { PhotoChip } from "@/components/form/photo-chip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { uploadPatternFile } from "@/lib/pattern-upload";
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
                <PhotoChip
                  key={path}
                  src={assetUrl(path)}
                  onDelete={() =>
                    setImagePaths((current) => current.filter((p) => p !== path))
                  }
                />
              ))}
            </div>
          )}

          <FileField
            id="manual-images"
            accept="image/*"
            multiple
            onFiles={uploadImages}
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
