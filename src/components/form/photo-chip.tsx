"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { AssetImage } from "@/components/asset-image";
import { cn } from "@/lib/utils";

/**
 * Miniatura de foto con botón de borrar, para las fichas de imagen de los
 * forms (fotos de gasto, imágenes de patrón, capturas de IA…). Usaba el
 * mismo JSX repetido en cuatro formularios; el fallback de imagen rota lo
 * aporta AssetImage.
 */
export function PhotoChip({
  src,
  onDelete,
  size = "size-16",
  className,
}: {
  src: string;
  onDelete?: () => void;
  size?: string;
  className?: string;
}) {
  const t = useTranslations("Forms");
  return (
    <div className={cn("relative", className)}>
      <AssetImage
        src={src}
        alt=""
        className={cn(size, "rounded-lg border object-cover")}
      />
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("delete")}
          className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5 text-muted-foreground transition-colors hover:text-destructive"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
