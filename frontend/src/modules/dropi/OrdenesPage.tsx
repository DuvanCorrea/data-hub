// ─── OrdenesPage (modules/dropi/OrdenesPage.tsx) ─────────────────────────────
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Search, X, SlidersHorizontal, Package, RefreshCw, AlertTriangle,
} from "lucide-react";
import { dropiService } from "./dropi.service";
import type { OrdenListDto } from "@/contracts/api.types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat("es-CO");

const ESTATUS_STYLE: Record<string, string> = {
  ENTREGADO:  "bg-green-500/15 text-green-400  border-green-500/30",
  DEVOLUCION: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  CANCELADO:  "bg-red-500/15   text-red-400    border-red-500/30",
  NOVEDAD:    "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

function EstatusBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground/50">—</span>;
  const cls = ESTATUS_STYLE[value.toUpperCase()] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider whitespace-nowrap", cls)}>
      {value}
    </span>
  );
}

export function OrdenesPage() {
  const navigate   = useNavigate();
  const [params] = useSearchParams();

  // ── Filtros ───────────────────────────────────────────────────────────────
  const [search,     setSearch]     = useState("");
  const [estatus,    setEstatus]    = useState(params.get("estatus") ?? "");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // ── Paginación ────────────────────────────────────────────────────────────
  const [page, setPage]   = useState(0);
  const [size]            = useState(50);
  const [sortBy]          = useState("fecha");
  const [sortDir]         = useState<"asc" | "desc">("desc");

  // ── Datos ─────────────────────────────────────────────────────────────────
  const [rows,       setRows]       = useState<OrdenListDto[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dropiService.listOrdenes({
        estatus:    estatus    || undefined,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        page, size, sortBy, sortDir,
      });
      setRows(res.content);
      setTotal(res.totalElements);
      setTotalPages(res.totalPages);
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.message ?? "No se pudo cargar las órdenes.");
    } finally { setLoading(false); }
  }, [estatus, fechaDesde, fechaHasta, page, size, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);

  const activeFilters = [estatus, fechaDesde, fechaHasta].filter(Boolean).length;

  // Filtro local por búsqueda de texto (nombre, ID, guía)
  const filtered = search
    ? rows.filter(r =>
        [r.dropiId, r.nombreCliente, r.telefono, r.numeroGuia, r.ciudadDestino, r.tienda]
          .some(v => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : rows;

  const start = page * size + 1;
  const end   = Math.min((page + 1) * size, total);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Órdenes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {NUM.format(total)} órdenes en total
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por ID, cliente, guía…"
            className="w-full rounded-md border border-border bg-muted/30 pl-8 pr-7 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
        </div>

        {/* Filtros */}
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setShowFilters(v => !v)}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {activeFilters > 0 && <span className="rounded-full bg-primary/20 text-primary px-1.5 text-[10px] font-medium">{activeFilters}</span>}
        </Button>
      </div>

      {/* Panel filtros */}
      {showFilters && (
        <div className="rounded-lg border border-border bg-card p-4 flex flex-wrap gap-4 animate-fade-in">
          {/* Estatus */}
          <div className="space-y-1 min-w-[160px]">
            <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Estado</label>
            <select value={estatus} onChange={e => { setEstatus(e.target.value); setPage(0); }}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
              <option value="">Todos</option>
              {["ENTREGADO","DEVOLUCION","CANCELADO","NOVEDAD","PENDIENTE"].map(s =>
                <option key={s} value={s}>{s}</option>
              )}
            </select>
          </div>
          {/* Fecha desde */}
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Fecha desde</label>
            <input type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setPage(0); }}
              className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          {/* Fecha hasta */}
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Fecha hasta</label>
            <input type="date" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setPage(0); }}
              className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          {activeFilters > 0 && (
            <div className="flex items-end">
              <button onClick={() => { setEstatus(""); setFechaDesde(""); setFechaHasta(""); setPage(0); }}
                className="text-xs text-muted-foreground hover:text-primary pb-1.5">
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-400 flex gap-2 items-center">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {/* Tabla */}
      <div className="relative rounded-lg border border-border overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-background/70 z-10 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && filtered.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Package className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No hay órdenes para mostrar.</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/80 border-b border-border">
                <tr>
                  {["ID Dropi","Fecha","Estado","Cliente","Ciudad","Transportadora","Total","Ganancia","Tienda","Items"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap border-r border-border last:border-r-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map(r => (
                  <tr key={r.id}
                    onClick={() => navigate(`/dropi/ordenes/${r.id}`)}
                    className="hover:bg-muted/20 cursor-pointer transition-colors">
                    <td className="px-3 py-2 font-mono text-primary">{r.dropiId}</td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{r.fecha ?? "—"}</td>
                    <td className="px-3 py-2"><EstatusBadge value={r.estatus} /></td>
                    <td className="px-3 py-2 max-w-[160px] truncate" title={r.nombreCliente ?? ""}>{r.nombreCliente ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.ciudadDestino ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.transportadora ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-right">{r.totalOrden != null ? COP.format(r.totalOrden) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-right text-green-400">{r.ganancia != null ? COP.format(r.ganancia) : "—"}</td>
                    <td className="px-3 py-2 max-w-[120px] truncate" title={r.tienda ?? ""}>{r.tienda ?? "—"}</td>
                    <td className="px-3 py-2 text-center">
                      {r.tieneItems && <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" title="Tiene items" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {total === 0 ? "Sin registros" : `${NUM.format(start)}–${NUM.format(end)} de ${NUM.format(total)}`}
        </span>
        <div className="flex items-center gap-1">
          {[
            [<ChevronsLeft className="h-3.5 w-3.5" />, () => setPage(0),               page === 0],
            [<ChevronLeft  className="h-3.5 w-3.5" />, () => setPage(p => p - 1),      page === 0],
            [<ChevronRight className="h-3.5 w-3.5" />, () => setPage(p => p + 1),      page >= totalPages - 1],
            [<ChevronsRight className="h-3.5 w-3.5" />, () => setPage(totalPages - 1), page >= totalPages - 1],
          ].map(([icon, handler, disabled], i) => (
            <Button key={i} variant="outline" size="icon" className="h-7 w-7"
              onClick={handler as any} disabled={disabled as boolean || loading}>
              {icon as React.ReactNode}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
