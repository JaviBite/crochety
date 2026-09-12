"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Buscador de texto de un listado. Escribe `?q=` en la URL (con debounce) y
 * conserva el resto de parámetros (tag, color). La página lee `searchParams.q`
 * y filtra la query de servidor. El input queda montado entre navegaciones al
 * mismo route, así que no pierde el foco al teclear.
 */
export function ListSearch({ className }: { className?: string }) {
  const t = useTranslations("Forms");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Sincroniza con el parámetro externo (atrás/adelante, enlaces con ?q=).
  // Ignora cambios causados por el propio debounce (mismo valor).
  const externalQ = searchParams.get("q") ?? "";
  useEffect(() => {
    setValue((current) =>
      current === externalQ || (timeout.current && current.trim() === externalQ)
        ? current
        : externalQ,
    );
  }, [externalQ]);

  function commit(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = next.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function onChange(next: string) {
    setValue(next);
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => commit(next), 300);
  }

  function clear() {
    clearTimeout(timeout.current);
    setValue("");
    commit("");
  }

  return (
    <div className={className}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("search")}
          className="pl-9 pr-9"
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            aria-label={t("searchClear")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
