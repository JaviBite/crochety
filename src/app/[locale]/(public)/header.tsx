"use client";

import { useEffect, useState } from "react";
import { LocaleSwitcher } from "@/components/theme/locale-switcher";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Cabecera pública: sticky con fondo translúcido + blur al hacer scroll
 * (client para poder escuchar el scroll sin servidor intermedio).
 */
export function SiteHeader({ workshopName }: { workshopName: string }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors duration-200",
        scrolled
          ? "border-b border-border/60 bg-background/80 shadow-sm backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-heading text-lg font-bold tracking-tight transition-colors hover:text-primary"
        >
          🧶 {workshopName}
        </Link>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
