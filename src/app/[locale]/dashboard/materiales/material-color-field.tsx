"use client";

import { Pipette } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ChangeEvent, type MouseEvent, useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dominantColorHex, rgbToHex } from "@/lib/color";

const MAX_PREVIEW = 320;

/**
 * Campo combinado de foto + color del material. Al elegir una foto detecta el
 * color dominante (Canvas en cliente, sin dependencias) y permite corregirlo
 * con el cuentagotas (clic sobre la imagen) o con el selector de color.
 *
 * Envía los mismos campos que antes: `photo` (File), `hasColor` (checkbox) y
 * `colorHex` (input color) — el parser de `lib/forms` no cambia.
 */
export function MaterialColorField({
  defaultPhotoPath,
  defaultColorHex,
  defaultHasColor,
}: {
  defaultPhotoPath?: string | null;
  defaultColorHex?: string | null;
  defaultHasColor: boolean;
}) {
  const t = useTranslations("Materials");
  const tForms = useTranslations("Forms");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [hasColor, setHasColor] = useState(defaultHasColor);
  const [color, setColor] = useState(defaultColorHex ?? "#a3e2c8");
  const [hasImage, setHasImage] = useState(Boolean(defaultPhotoPath));
  const [canSample, setCanSample] = useState(false);

  // Dibuja la imagen (escalada) en el canvas y comprueba si sus píxeles se
  // pueden leer (mismo origen / CORS permitido) para el cuentagotas.
  function drawToCanvas(img: HTMLImageElement): boolean {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const scale = Math.min(
      MAX_PREVIEW / img.naturalWidth,
      MAX_PREVIEW / img.naturalHeight,
      1,
    );
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    try {
      ctx.getImageData(0, 0, 1, 1);
      return true;
    } catch {
      return false; // canvas contaminado por CORS: sin cuentagotas
    }
  }

  function detectDominant() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    try {
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hex = dominantColorHex(data, { step: 2 });
      if (hex) {
        setColor(hex);
        setHasColor(true);
      }
    } catch {
      // canvas contaminado: no se puede detectar
    }
  }

  // Modo edición: carga la foto existente en el canvas al montar.
  useEffect(() => {
    if (!defaultPhotoPath) return;
    const img = new Image();
    img.onload = () => setCanSample(drawToCanvas(img));
    img.src = `/api/files/${defaultPhotoPath}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Limpia el object URL al desmontar.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      const ok = drawToCanvas(img);
      setHasImage(true);
      setCanSample(ok);
      if (ok) detectDominant();
    };
    img.src = url;
  }

  function sampleAt(event: MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !canSample) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height);
    try {
      const { data } = ctx.getImageData(x, y, 1, 1);
      setColor(rgbToHex(data[0], data[1], data[2]));
      setHasColor(true);
    } catch {
      // ignora
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="photo">
          {t("fieldPhoto")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <Input
          id="photo"
          name="photo"
          type="file"
          accept="image/*"
          onChange={onFileChange}
        />
      </div>

      <div className={hasImage ? "space-y-1.5" : "hidden"}>
        {/* Vista previa que además actúa de cuentagotas. El selector de color
            de abajo ofrece la alternativa accesible por teclado. */}
        <canvas
          ref={canvasRef}
          onClick={sampleAt}
          role="img"
          aria-label={t("fieldPhoto")}
          className={`max-h-64 w-auto max-w-full rounded-lg border ${canSample ? "cursor-crosshair" : ""}`}
        />
        {canSample && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Pipette className="size-3" />
            {t("colorEyedropper")}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Checkbox
          id="hasColor"
          name="hasColor"
          checked={hasColor}
          onCheckedChange={(checked) => setHasColor(checked === true)}
        />
        <Label htmlFor="hasColor">{t("fieldHasColor")}</Label>
        <Input
          id="colorHex"
          name="colorHex"
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          disabled={!hasColor}
          className="h-9 w-16 cursor-pointer p-1"
          aria-label={t("fieldColor")}
        />
        <span className="font-mono text-xs text-muted-foreground">{color}</span>
      </div>
      <p className="text-xs text-muted-foreground">{t("colorHint")}</p>
    </div>
  );
}
