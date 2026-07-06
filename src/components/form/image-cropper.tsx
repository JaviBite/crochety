"use client";

import { useTranslations } from "next-intl";
import { type PointerEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { type Rect, rectFromPoints, scaleCropToNatural } from "@/lib/crop";

/**
 * Recorte de imagen en cliente: se arrastra un rectángulo sobre la imagen para
 * acotar el producto y se devuelve la región recortada como data URL (JPEG),
 * lista para mandar a la IA de gastos. También permite usar la imagen completa.
 */
export function ImageCropper({
  src,
  onCropped,
  onCancel,
}: {
  src: string;
  onCropped: (dataUrl: string) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("Expenses");
  const tForms = useTranslations("Forms");
  const imgRef = useRef<HTMLImageElement>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<Rect | null>(null);

  function pointFromEvent(event: PointerEvent) {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
    };
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    setStart(point);
    setSelection({ x: point.x, y: point.y, width: 0, height: 0 });
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!start) return;
    setSelection(rectFromPoints(start, pointFromEvent(event)));
  }

  function onPointerUp() {
    setStart(null);
  }

  function crop(useFull: boolean) {
    const img = imgRef.current;
    if (!img) return;
    const natural = { width: img.naturalWidth, height: img.naturalHeight };
    const displayed = img.getBoundingClientRect();

    let region: Rect = { x: 0, y: 0, width: natural.width, height: natural.height };
    if (!useFull && selection) {
      const scaled = scaleCropToNatural(
        selection,
        { width: displayed.width, height: displayed.height },
        natural,
      );
      if (scaled) region = scaled;
    }

    const canvas = document.createElement("canvas");
    canvas.width = region.width;
    canvas.height = region.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      img,
      region.x,
      region.y,
      region.width,
      region.height,
      0,
      0,
      region.width,
      region.height,
    );
    onCropped(canvas.toDataURL("image/jpeg", 0.9));
  }

  return (
    <div className="space-y-2">
      <div
        className="relative inline-block max-w-full cursor-crosshair touch-none overflow-hidden rounded-lg border select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          className="block max-h-[60vh] w-auto max-w-full"
        />
        {selection && selection.width > 2 && selection.height > 2 && (
          <div
            className="pointer-events-none absolute border-2 border-primary bg-primary/15"
            style={{
              left: selection.x,
              top: selection.y,
              width: selection.width,
              height: selection.height,
            }}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => crop(false)}>
          {t("cropSelection")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => crop(true)}>
          {t("cropFull")}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            {tForms("cancel")}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("cropHint")}</p>
    </div>
  );
}
