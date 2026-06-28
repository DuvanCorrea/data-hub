// ─── JobStatusBadge (modules/import-jobs/components/JobStatusBadge.tsx) ───────
import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/contracts/api.types";

const STATUS_LABELS: Record<JobStatus, string> = {
  PENDING: "Pendiente",
  RUNNING: "Procesando",
  COMPLETED: "Completado",
  ERROR: "Error",
};

interface JobStatusBadgeProps {
  status: JobStatus;
}

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const variant = status.toLowerCase() as "pending" | "running" | "completed" | "error";
  return <Badge variant={variant}>{STATUS_LABELS[status] ?? status}</Badge>;
}
