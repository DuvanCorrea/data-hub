// ─── Import Jobs Page (modules/import-jobs/ImportJobsPage.tsx) ────────────────
import { useEffect, useState, useCallback } from "react";
import { RefreshCw, FileText, Loader2 } from "lucide-react";
import type { ImportJobDto } from "@/contracts/api.types";
import { importJobsService } from "./import-jobs.service";
import { JobStatusBadge } from "./components/JobStatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

const POLL_INTERVAL_MS = 3000;

export function ImportJobsPage() {
  const [jobs, setJobs] = useState<ImportJobDto[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const page = await importJobsService.listJobs({ size: 20 });
      setJobs(page.content);
      setTotalElements(page.totalElements);
      setError(null);
    } catch {
      setError("No se pudo cargar la lista de jobs.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load + poll every 3s if there are active jobs
  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadJobs]);

  const hasActiveJobs = jobs.some((j) => j.status === "PENDING" || j.status === "RUNNING");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Jobs de Importación</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalElements} {totalElements === 1 ? "job registrado" : "jobs registrados"}
            {hasActiveJobs && <span className="ml-2 text-primary">· actualizando…</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadJobs} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && jobs.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && jobs.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Sin jobs todavía</p>
              <p className="text-xs text-muted-foreground mt-1">
                Sube un archivo Excel para crear el primer job de importación.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job list */}
      {jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ job }: { job: ImportJobDto }) {
  return (
    <Card className="transition-colors hover:border-border/80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm tabular">Job #{job.id}</CardTitle>
              <CardDescription className="text-xs">{job.template}</CardDescription>
            </div>
          </div>
          <JobStatusBadge status={job.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar — only when in progress */}
        {(job.status === "RUNNING" || job.status === "COMPLETED") && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progreso</span>
              <span className="tabular font-medium text-foreground">{job.progress}%</span>
            </div>
            <Progress value={job.progress} />
            <p className="text-[11px] text-muted-foreground tabular">
              {job.rowsDone.toLocaleString("es-CO")} / {job.rowsTotal.toLocaleString("es-CO")} filas
            </p>
          </div>
        )}

        {/* Error message */}
        {job.status === "ERROR" && job.errorMsg && (
          <p className="rounded border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-red-400 font-mono">
            {job.errorMsg}
          </p>
        )}

        {/* Timestamps */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          {job.startedAt && (
            <span>Inicio: <span className="text-foreground">{formatDate(job.startedAt)}</span></span>
          )}
          {job.finishedAt && (
            <span>Fin: <span className="text-foreground">{formatDate(job.finishedAt)}</span></span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
