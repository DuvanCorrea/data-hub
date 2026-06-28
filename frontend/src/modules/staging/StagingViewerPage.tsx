// ─── Visor de Registros Importados (modules/staging/StagingViewerPage.tsx) ────
//
// Muestra los registros importados de cualquier tipo de archivo.
//
// Modos:
//   /staging                      → selección de tipo de archivo (pantalla inicial)
//   /staging?template=DROPI_ORDER → todos los registros de ese tipo
//   /staging?jobId=42             → registros de una importación específica
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Database,
  FileSpreadsheet,
  ChevronRight,
  Inbox,
} from "lucide-react";
import type { StagingPageResponse, StagingRow } from "@/contracts/api.types";
import { stagingService } from "./staging.service";
import { DynamicDataTable } from "./components/DynamicDataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TEMPLATES, getTemplateLabel } from "@/lib/templates";

export function StagingViewerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // ── Parámetros ────────────────────────────────────────────────────────────
  const jobId       = searchParams.get("jobId") ? Number(searchParams.get("jobId")) : null;
  const urlTemplate = searchParams.get("template");

  const [selectedTemplate, setSelectedTemplate] = useState(
    urlTemplate ?? TEMPLATES[0].id
  );

  // ── Paginación / orden ────────────────────────────────────────────────────
  const [page,    setPage]    = useState(0);
  const [size,    setSize]    = useState(50);
  const [sortBy,  setSortBy]  = useState("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ── Datos ─────────────────────────────────────────────────────────────────
  const [data,      setData]      = useState<StagingPageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // ── Carga ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    // No cargar si no tenemos ningún criterio
    if (!jobId && !urlTemplate && !selectedTemplate) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = jobId
        ? await stagingService.getPage({ jobId, page, size, sortBy, sortDir })
        : await stagingService.getAllPage({
            template: selectedTemplate,
            page,
            size,
            sortBy,
            sortDir,
          });
      setData(result);
    } catch (err: any) {
      const msg = err.response?.data?.message ?? "No se pudieron cargar los registros.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [jobId, selectedTemplate, page, size, sortBy, sortDir, urlTemplate]);

  useEffect(() => {
    // Solo cargar si tenemos un criterio de búsqueda
    if (jobId || urlTemplate) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // ── Cambio de tipo de archivo ─────────────────────────────────────────────
  const handleTemplateChange = (t: string) => {
    setSelectedTemplate(t);
    setPage(0);
    setSortBy("id");
    setSortDir("asc");
    setData(null);
    setError(null);
    setSearchParams({ template: t });
  };

  // ── Handlers de tabla ─────────────────────────────────────────────────────
  const handleSort = (key: string, dir: "asc" | "desc") => {
    setSortBy(key);
    setSortDir(dir);
    setPage(0);
  };

  const handleSize = (s: number) => { setSize(s); setPage(0); };

  // ── Export all ───────────────────────────────────────────────────────────
  const handleExportAll = useCallback(
    (onProgress: (l: number, t: number) => void): Promise<StagingRow[]> =>
      stagingService.fetchAllRows(
        jobId ? { jobId } : { template: selectedTemplate },
        onProgress
      ),
    [jobId, selectedTemplate]
  );

  const activeTemplate = data?.template ?? selectedTemplate;

  // ═══════════════════════════════════════════════════════════════════════════
  // PANTALLA DE SELECCIÓN (sin jobId ni template en URL)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!jobId && !urlTemplate) {
    return (
      <div className="space-y-8 max-w-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5 shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Ver Registros</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Selecciona el tipo de archivo para explorar sus registros importados.
            </p>
          </div>
        </div>

        {/* Cards de tipo */}
        <div className="grid gap-3">
          {TEMPLATES.map((t) => (
            <Card
              key={t.id}
              className="cursor-pointer transition-all hover:border-primary/50 hover:bg-muted/20 hover:shadow-sm"
              onClick={() => handleTemplateChange(t.id)}
            >
              <CardContent className="flex items-center gap-4 py-4 px-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA DE REGISTROS
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5 shrink-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 min-w-0">
          {/* Título */}
          <h1 className="text-xl font-semibold tracking-tight">
            {jobId ? `Importación #${jobId}` : "Registros importados"}
          </h1>

          {/* Info secundaria */}
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="text-foreground font-medium">
              {getTemplateLabel(activeTemplate)}
            </span>
            {data && (
              <>
                {" · "}
                <span className="tabular-nums">
                  {data.totalElements.toLocaleString("es-CO")} registros
                </span>
              </>
            )}
          </p>
        </div>

        {/* Selector de tipo — solo cuando NO hay jobId */}
        {!jobId && (
          <div className="shrink-0">
            <label className="block text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1 text-right">
              Tipo de archivo
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer hover:border-primary/50 transition-colors"
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        )}

        <Button variant="outline" size="sm" onClick={load} disabled={isLoading} className="h-9 shrink-0 self-end">
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

      {/* ── Skeleton ─────────────────────────────────────────────────────── */}
      {isLoading && !data && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="h-10 bg-muted/60 border-b border-border" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3 border-b border-border/50 last:border-0">
              <div className="h-3 w-8 rounded bg-muted animate-pulse" />
              <div className="h-3 w-24 rounded bg-muted animate-pulse" />
              <div className="h-3 flex-1 rounded bg-muted animate-pulse opacity-50" />
            </div>
          ))}
        </div>
      )}

      {/* ── Estado vacío (0 registros, sin error, sin loading) ───────────── */}
      {!isLoading && !error && data && data.totalElements === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-lg border border-border bg-muted/10">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-sm">Sin registros para este tipo</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              No se encontraron registros de{" "}
              <span className="font-medium text-foreground">{getTemplateLabel(activeTemplate)}</span>.
              {!jobId && " Sube un archivo de este tipo desde la sección Subir Archivo."}
            </p>
          </div>
          {!jobId && (
            <Button variant="outline" size="sm" onClick={() => navigate("/upload")}>
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Subir archivo
            </Button>
          )}
        </div>
      )}

      {/* ── Tabla ─────────────────────────────────────────────────────────── */}
      {data && data.totalElements > 0 && (
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
          onExportAll={handleExportAll}
        />
      )}

      {/* Tabla vacía con filtros activos */}
      {data && data.totalElements > 0 && !isLoading && data.rows.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Database className="h-6 w-6 mx-auto mb-2 opacity-40" />
          Ningún registro coincide con los filtros actuales.
        </div>
      )}
    </div>
  );
}
