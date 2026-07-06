"use client";

import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { type ViewMode, viewCookieName } from "@/lib/view";

/**
 * Conmuta entre vista cuadrícula y lista de un listado. Persiste la elección en
 * una cookie por sección y refresca los componentes de servidor para que la
 * página vuelva a renderizar la variante elegida (sin recarga completa).
 */
export function ViewToggle({
  section,
  value,
}: {
  section: string;
  value: ViewMode;
}) {
  const t = useTranslations("Forms");
  const router = useRouter();

  function setView(mode: ViewMode) {
    if (mode === value) return;
    document.cookie = `${viewCookieName(section)}=${mode}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="inline-flex items-center rounded-lg border p-0.5" role="group">
      <Button
        type="button"
        variant={value === "grid" ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label={t("viewGrid")}
        aria-pressed={value === "grid"}
        onClick={() => setView("grid")}
      >
        <LayoutGrid />
      </Button>
      <Button
        type="button"
        variant={value === "list" ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label={t("viewList")}
        aria-pressed={value === "list"}
        onClick={() => setView("list")}
      >
        <List />
      </Button>
    </div>
  );
}
