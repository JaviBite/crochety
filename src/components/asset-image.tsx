"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

// Reemplazo directo de <img> para los assets servidos por /api/files: si el
// fichero no existe (404 de Blob/disco) muestra un placeholder bonito en vez
// de la imagen rota del navegador. Las mismas clases que llevaría la <img>
// aplican al placeholder, de modo que ocupa el mismo hueco.
export function AssetImage({
  src,
  alt,
  className,
  fallbackColor,
  fallbackIcon,
  loading = "lazy",
}: {
  src: string | null;
  alt: string;
  /** Clases compartidas entre <img> y placeholder (w-full, h-36, object-cover…). */
  className?: string;
  /** Color (CSS) para el placeholder-swatch, p. ej. el color del material. */
  fallbackColor?: string | null;
  /** Icono del placeholder cuando no hay swatch (por defecto, ImageOff). */
  fallbackIcon?: ReactNode;
  loading?: "lazy" | "eager";
}) {
  const [broken, setBroken] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // onError solo cubre fallos tras montar: una imagen que ya llegó rota del
  // servidor (404 antes de hidratar) queda complete con naturalWidth 0.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setBroken(true);
  }, []);

  if (!src || broken) {
    return (
      <div
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={cn(
          "flex items-center justify-center bg-accent text-accent-foreground/40 aspect-[4/3]",
          className,
        )}
      >
        {fallbackColor ? (
          <span
            aria-hidden
            className="size-8 rounded-full border border-foreground/10 shadow-sm"
            style={{ backgroundColor: fallbackColor }}
          />
        ) : (
          fallbackIcon ?? <ImageOff aria-hidden className="size-6" />
        )}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => setBroken(true)}
    />
  );
}
