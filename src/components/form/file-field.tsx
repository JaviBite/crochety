"use client";

import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Campo de fichero con dropzone (drag&drop + clic) en lugar del input nativo
 * ("Choose File…"). Solo UI: la subida/formateo la hace cada formulario vía
 * `onFiles`. Con `name`, el fichero viaja en el FormData de la server action
 * (pedido/material) y no se limpia el input; sin `name` la subida es en
 * cliente (patrones/convertidor/gasto) y se resetea para poder re-elegirlo.
 * `children` muestra los adjuntos actuales (chips/previews) encima.
 */
export function FileField({
  id,
  name,
  accept,
  multiple,
  disabled,
  hint,
  children,
  onFiles,
  className,
}: {
  id: string;
  /** Ponerlo solo si el fichero debe viajar en el FormData de la action. */
  name?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  hint?: string;
  children?: ReactNode;
  onFiles?: (files: File[]) => void;
  className?: string;
}) {
  const t = useTranslations("Forms");
  const [dragging, setDragging] = useState(false);

  function picked(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length > 0) onFiles?.(files);
  }

  return (
    <div className={cn("space-y-2", className)}>
      {children}
      <label
        htmlFor={id}
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (disabled) return;
          picked(event.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground transition-colors",
          "hover:border-primary/60 hover:bg-accent/40 hover:text-foreground",
          dragging && "border-primary bg-accent text-foreground",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <Upload aria-hidden className="size-5" />
        <span>{multiple ? t("fileDropMulti") : t("fileDrop")}</span>
        <input
          id={id}
          name={name}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            picked(event.target.files);
            if (!name) event.target.value = "";
          }}
        />
      </label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
