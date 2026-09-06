"use client";

import { Palette } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ACCENTS, type Accent } from "@/lib/theme";

// Muestras del selector: los mismos oklch que las vars --primary de globals.css
// para cada acento (modo claro), así la muestra coincide con el color aplicado.
const SWATCHES: Record<Accent, string> = {
  mint: "oklch(0.56 0.09 170)",
  lavender: "oklch(0.56 0.13 295)",
  peach: "oklch(0.6 0.12 45)",
  sky: "oklch(0.56 0.11 235)",
};

function applyAccent(accent: Accent) {
  document.documentElement.dataset.accent = accent;
  // Persistir un año; el layout del servidor lee la cookie y evita el flash.
  document.cookie = `accent=${accent}; path=/; max-age=31536000; samesite=lax`;
}

export function AccentPicker() {
  const t = useTranslations("Theme");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("accent")}>
          <Palette className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {ACCENTS.map((accent) => (
          <DropdownMenuItem key={accent} onClick={() => applyAccent(accent)}>
            <span
              aria-hidden
              className="mr-2 inline-block size-3 rounded-full border"
              style={{ backgroundColor: SWATCHES[accent] }}
            />
            {t(accent)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
