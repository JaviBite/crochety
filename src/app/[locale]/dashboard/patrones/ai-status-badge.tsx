import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import type { PatternAiStatus } from "@/lib/validations";

const AI_STATUS_CLASSES: Record<PatternAiStatus, string> = {
  NONE: "bg-muted text-muted-foreground",
  PENDING: "bg-accent text-accent-foreground",
  PROCESSING: "bg-accent text-accent-foreground",
  DONE: "bg-primary/15 text-primary",
  ERROR: "bg-destructive/15 text-destructive",
  MULTIPLE: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

export async function AiStatusBadge({ status }: { status: string }) {
  const t = await getTranslations("PatternAiStatus");
  return (
    <Badge
      variant="outline"
      className={`border-transparent ${AI_STATUS_CLASSES[status as PatternAiStatus] ?? ""}`}
    >
      {t(status)}
    </Badge>
  );
}
