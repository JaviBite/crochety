import type { OrderStatus, PatternAiStatus } from "@/lib/validations";

// Metadatos visuales de estado, únicos para toda la app (antes duplicados en
// pedidos/page.tsx, pedidos/[id]/page.tsx y ai-status-badge.tsx). Cada badge
// lleva un puntito del color para leer el estado de un vistazo.
export type StatusTone = {
  /** Clases del Badge (fondo/texto). */
  className: string;
  /** Clases del puntito dentro del badge. */
  dot: string;
  /** Puntito para la variante overlay (badge opaco sobre imágenes). */
  overlayDot: string;
};

export const ORDER_STATUS_TONES: Record<OrderStatus, StatusTone> = {
  SIN_EMPEZAR: {
    className: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
    overlayDot: "bg-muted-foreground/50",
  },
  EMPEZADO: {
    className: "bg-accent text-accent-foreground",
    dot: "bg-accent-foreground/60",
    overlayDot: "bg-primary/60",
  },
  TERMINADO: {
    className: "bg-primary/15 text-primary",
    dot: "bg-primary",
    overlayDot: "bg-primary",
  },
  COBRADO: {
    className: "bg-primary text-primary-foreground",
    dot: "bg-primary-foreground",
    overlayDot: "bg-primary",
  },
};

export const AI_STATUS_TONES: Record<PatternAiStatus, StatusTone> = {
  NONE: {
    className: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
    overlayDot: "bg-muted-foreground/50",
  },
  PENDING: {
    className: "bg-accent text-accent-foreground",
    dot: "bg-accent-foreground/60",
    overlayDot: "bg-primary/60",
  },
  PROCESSING: {
    className: "bg-accent text-accent-foreground",
    dot: "bg-accent-foreground/60",
    overlayDot: "bg-primary/60",
  },
  DONE: {
    className: "bg-primary/15 text-primary",
    dot: "bg-primary",
    overlayDot: "bg-primary",
  },
  ERROR: {
    className: "bg-destructive/15 text-destructive",
    dot: "bg-destructive",
    overlayDot: "bg-destructive",
  },
  MULTIPLE: {
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    overlayDot: "bg-amber-500",
  },
};

// Variantes tolerantes: los estados viajan como String en BD, así que un valor
// desconocido cae al tono neutro en vez de romper el render.
export function orderStatusTone(status: string): StatusTone {
  return ORDER_STATUS_TONES[status as OrderStatus] ?? ORDER_STATUS_TONES.SIN_EMPEZAR;
}

export function aiStatusTone(status: string): StatusTone {
  return AI_STATUS_TONES[status as PatternAiStatus] ?? AI_STATUS_TONES.NONE;
}
