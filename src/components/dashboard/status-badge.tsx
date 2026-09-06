import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { aiStatusTone, orderStatusTone } from "@/lib/status";

// Badge de estado con puntito de color, compartido por pedidos y patrones.
// Las etiquetas salen de los namespaces ya existentes (OrderStatus /
// PatternAiStatus) según el kind.
export async function StatusBadge({
  status,
  kind,
}: {
  status: string;
  kind: "order" | "patternAi";
}) {
  const tone = kind === "order" ? orderStatusTone(status) : aiStatusTone(status);
  const [t, tFallback] = await Promise.all([
    getTranslations(kind === "order" ? "OrderStatus" : "PatternAiStatus"),
    getTranslations("Common"),
  ]);
  return (
    <Badge variant="outline" className={`border-transparent ${tone.className}`}>
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} />
      {t.has(status) ? t(status) : tFallback("unknownStatus")}
    </Badge>
  );
}
