// ─── Staging Viewer Page (modules/staging/StagingViewerPage.tsx) ──────────────
// Visor genérico de datos de staging para cualquier job de importación.
// Recibe el jobId por query-param: /staging?jobId=42
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { TableIcon, AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import type { StagingPageResponse } from "@/contracts/api.types";
import { stagingService } from "./staging.service";
import { DynamicDataTable } from "./components/DynamicDataTable";
import { Button } from "@/components/ui/button";

export function StagingViewerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = Number(searchParams.get("jobId") ?? "0");
  const template = searchParams.get("template");

  // ── Estado de paginación y ordenamiento ──────────────────────────────────
  const [page,    setPage]    = useState(0);
  const [size,    setSize]    = useState(50);
  const [sortBy,  setSortBy]  = useState("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ── Estado de datos ──────────────────────────────────────────────────────
  const [data,       setData]       = useState<StagingPageResponse | null>(null);
  const [isLoading,  setIsLoading]  = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!jobId && !template) { setError("jobId o template inválido."); setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const result = jobId 
        ? await stagingService.getPage({ jobId, page, size, sortBy, sortDir })
        : await stagingService.getAllPage({ template: template!, page, size, sortBy, sortDir });
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message ?? "No se pudo cargar los datos de staging.");
    } finally {
      setIsLoading(false);
    }
  }, [jobId, template, page, size, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSort = (key: string, dir: "asc" | "desc") => {
    setSortBy(key);
    setSortDir(dir);
    setPage(0);
  };

  const handleSize = (s: number) => {
    setSize(s);
    setPage(0);
  };

  // ── Sin jobId ni template ──────────────────────────────────────────────────
  if (!jobId && !template) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <AlertTriangle className="h-8 w-8 text-yellow-400" />
        <div>
          <p className="font-medium">Falta parámetro de búsqueda</p>
          <p className="text-sm text-muted-foreground mt-1">
            Se requiere jobId o template para visualizar los datos.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/import-jobs")}>
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a jobs
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <TableIcon className="h-4 w-4 text-primary" />
              <h1 className="text-xl font-semibold tracking-tight">
                {jobId ? `Datos de staging — Job #${jobId}` : `Datos de staging — ${template}`}
              </h1>
            </div>
            {data && (
              <p className="text-sm text-muted-foreground mt-0.5 ml-6">
                Template:{" "}
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">
                  {data.template}
                </span>
                {" · "}
                <span className="tabular-nums">{data.totalElements.toLocaleString("es-CO")}</span> registros totales
              </p>
            )}
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={load} disabled={isLoading} className="shrink-0">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Skeleton inicial ──────────────────────────────────────────────── */}
      {isLoading && !data && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="h-10 bg-muted/60 border-b border-border" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-2.5 border-b border-border/50 last:border-0">
              <div className="h-3.5 w-8 rounded bg-muted animate-pulse" />
              <div className="h-3.5 w-24 rounded bg-muted animate-pulse" />
              <div className="h-3.5 flex-1 rounded bg-muted animate-pulse opacity-60" />
            </div>
          ))}
        </div>
      )}

      {/* ── Tabla dinámica ────────────────────────────────────────────────── */}
      {data && (
        <DynamicDataTable
          columns={data.columns}
          rows={data.rows}
          totalElements={data.totalElements}
          totalPages={data.totalPages}
          page={page}
          size={size}
          sortBy={sortBy}
          sortDir={sortDir}
          isLoading={isLoading}
          onPageChange={setPage}
          onSizeChange={handleSize}
          onSortChange={handleSort}
        />
      )}
    </div>
  );
}
