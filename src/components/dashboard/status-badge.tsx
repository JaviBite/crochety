import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { aiStatusTone, orderStatusTone } from "@/lib/status";

// Badge de estado con puntito de color, compartido por pedidos y patrones.
// Las etiquetas salen de los namespaces ya existentes (OrderStatus /
// PatternAiStatus) según el kind.
//
// Con `overlay` (p. ej. sobre la portada de una tarjeta) el fondo es opaco:
// los tonos translúcidos dejan ver la imagen de debajo y se leen mal.
export async function StatusBadge({
  status,
  kind,
  overlay = false,
}: {
  status: string;
  kind: "order" | "patternAi";
  overlay?: boolean;
}) {
  const tone = kind === "order" ? orderStatusTone(status) : aiStatusTone(status);
  const [t, tFallback] = await Promise.all([
    getTranslations(kind === "order" ? "OrderStatus" : "PatternAiStatus"),
    getTranslations("Common"),
  ]);
  return (
    <Badge
      variant="outline"
      className={
        overlay
          ? "border-transparent bg-card/95 text-foreground shadow-sm backdrop-blur-sm"
          : `border-transparent ${tone.className}`
      }
    >
      <span
        aria-hidden
        className={`size-1.5 shrink-0 rounded-full ${overlay ? tone.overlayDot : tone.dot}`}
      />
      {t.has(status) ? t(status) : tFallback("unknownStatus")}
    </Badge>
  );
}
