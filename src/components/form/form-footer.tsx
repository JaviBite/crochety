import type { ReactNode } from "react";

/**
 * Pie de formulario pegado al borde inferior (Guardar/Cancelar) con fondo
 * translúcido + blur. Comparte el ancho del form (sin margins negativos: el
 * form ya delimita su columna) y deja el contenido deslizar por debajo.
 */
export function FormFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-1 mt-8 rounded-b-2xl border-t bg-background/85 px-1 py-3 shadow-[0_-6px_20px_-16px_oklch(0.25_0.02_60/0.25)] backdrop-blur-md">
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}
