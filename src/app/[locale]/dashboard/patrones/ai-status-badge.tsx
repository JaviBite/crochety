import { StatusBadge } from "@/components/dashboard/status-badge";

// Badge del estado de IA del patrón: delega en el StatusBadge compartido
// (tonos en lib/status.ts).
export async function AiStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} kind="patternAi" />;
}
