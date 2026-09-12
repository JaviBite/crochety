"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { discardUploadAction } from "@/app/[locale]/dashboard/discard-upload";
import { FileField } from "@/components/form/file-field";
import { PhotoChip } from "@/components/form/photo-chip";
import { assetUrl } from "@/lib/assets";
import type { UploadKind } from "@/lib/files";
import { uploadPatternFile } from "@/lib/pattern-upload";

/**
 * Campo de imagen con el flujo completo: elegir/dropzone → preview local →
 * subida a /api/uploads (el body de las actions está limitado; trampa #10) →
 * miniatura con X. El form solo envía el pathname en un input hidden.
 *
 * Con `initialValue` (foto ya guardada) la X solo desvincula: la acción de
 * guardado borra el fichero si el registro se guarda sin ella. Una foto
 * subida en esta sesión y descartada es un huérfano: se borra al instante.
 */
export function ImageUploadField({
  id,
  kind,
  value,
  initialValue,
  onChange,
  onFile,
  hint,
  className,
}: {
  id: string;
  kind: UploadKind;
  /** Pathname actual (guardado o recién subido); null = sin foto. */
  value: string | null;
  /** Pathname persistido en BD, para saber cuándo una X borra un huérfano. */
  initialValue?: string | null;
  onChange: (value: string | null) => void;
  /** Al elegir el fichero, antes de subir (p. ej. cuentagotas del material). */
  onFile?: (file: File) => void;
  hint?: string;
  className?: string;
}) {
  const tForms = useTranslations("Forms");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function discard(path: string | null) {
    if (path && path !== initialValue) void discardUploadAction(path);
  }

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    onFile?.(file);
    setError(null);
    setUploading(true);
    try {
      const result = await uploadPatternFile(file, kind);
      if ("path" in result) {
        discard(value); // la foto que sustituye (si era nueva) ya no sirve
        onChange(result.path);
      } else {
        setError(result.error ?? tForms("uploadFailed"));
      }
    } catch {
      setError(tForms("uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  function remove() {
    discard(value);
    onChange(null);
  }

  return (
    <div className={className}>
      {value && (
        <div className="mb-2">
          <PhotoChip src={assetUrl(value)} onDelete={remove} />
        </div>
      )}
      <FileField
        id={id}
        accept="image/*"
        hint={hint}
        disabled={uploading}
        onFiles={handleFiles}
      />
      {uploading && (
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {tForms("uploading")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
