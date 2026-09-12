"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Animación de aparición al hacer scroll (fade-up). El estado inicial oculto
// solo aplica con JS activo (html.js en <html>, script inline del layout), así
// el contenido sin JS nunca queda invisible. Con prefers-reduced-motion se
// muestra directamente sin animar.
export function Reveal({
  children,
  className,
  delay,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Sin re-render: se añade la clase directamente y el componente queda
      // estático (no hay estado que re-sobrescriba el className).
      el.classList.add("reveal-visible");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", visible && "reveal-visible", className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
