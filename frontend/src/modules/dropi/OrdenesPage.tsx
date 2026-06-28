// ─── OrdenesPage (modules/dropi/OrdenesPage.tsx) ─────────────────────────────
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { dropiService } from "./dropi.service";
import type { OrdenListDto } from "@/contracts/api.types";
import { DataTable, StatusBadge } from "@/components/data-table/DataTable";
import type { ColumnDef } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat("es-CO");

// Columnas para la tabla de órdenes
const ORDEN_COLS: ColumnDef<OrdenListDto>[] = [
  { key: "dropiId",       label: "ID Dropi",       type: "text",     pinned: true,  minWidth: 90 },
  { key: "fecha",         label: "Fecha",          type: "date",     sortable: true },
  { key: "estatus",       label: "Estado",         type: "status",   sortable: true,
    render: (v) => <StatusBadge value={v as string} /> },
  { key: "nombreCliente", label: "Cliente",        type: "text",     minWidth: 140 },
  { key: "ciudadDestino", label: "Ciudad",         type: "text" },
  { key: "transportadora",label: "Transportadora", type: "text" },
  { key: "totalOrden",    label: "Total venta",    type: "currency", sortable: true },
  { key: "ganancia",      label: "Ganancia",       type: "currency", sortable: true },
  { key: "costoProveedorTotal", label: "Costo proveedor", type: "currency",
    render: (v) => {
      const n = Number(v);
      return n > 0
        ? <span className="tabular-nums font-mono text-right block text-emerald-400">{COP.format(n)}</span>
        : <span className="text-muted-foreground/40 select-none">—</span>;
    }
  },
  { key: "tienda",        label: "Tienda",         type: "text",     hidden: true },
  { key: "numeroGuia",    label: "Guía",           type: "text",     hidden: true },
  { key: "tieneItems",    label: "Items",          type: "custom",   sortable: false,
    render: (v) => v
      ? <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mx-auto block" title="Tiene items de producto" />
      : null
  },
];

export function OrdenesPage() {
  const navigate = useNavigate();

  // Filtros server-side
  const [estatus,     setEstatus]     = useState("");
  const [fechaDesde,  setFechaDesde]  = useState("");
  const [fechaHasta,  setFechaHasta]  = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Paginación
  const [page,       setPage]       = useState(0);
  const [size,       setSize]       = useState(50);
  const [sortBy,     setSortBy]     = useState("fecha");
  const [sortDir,    setSortDir]    = useState<"asc" | "desc">("desc");

  // Datos
  const [rows,       setRows]       = useState<OrdenListDto[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dropiService.listOrdenes({
        estatus: estatus || undefined,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        page, size, sortBy, sortDir,
      });
      setRows(res.content as OrdenListDto[]);
      setTotal(res.totalElements);
      setTotalPages(res.totalPages);
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.message ?? "No se pudo cargar las órdenes.");
    } finally { setLoading(false); }
  }, [estatus, fechaDesde, fechaHasta, page, size, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (key: string, dir: "asc" | "desc") => {
    setSortBy(key); setSortDir(dir); setPage(0);
  };

  const activeFilters = [estatus, fechaDesde, fechaHasta].filter(Boolean).length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Órdenes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{NUM.format(total)} órdenes en total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setShowFilters(v => !v)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros
            {activeFilters > 0 && <span className="rounded-full bg-primary/20 text-primary px-1.5 text-[10px] font-medium">{activeFilters}</span>}
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Panel de filtros server-side */}
      {showFilters && (
        <div className="rounded-lg border border-border bg-card p-4 flex flex-wrap gap-4 animate-fade-in">
          <div className="space-y-1 min-w-[160px]">
            <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Estado</label>
            <select value={estatus} onChange={e => { setEstatus(e.target.value); setPage(0); }}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
              <option value="">Todos</option>
              {["ENTREGADO","DEVOLUCION","CANCELADO","NOVEDAD","PENDIENTE",
                "INTENTO DE ENTREGA","RECLAME EN OFICINA","EN CAMINO"].map(s =>
                <option key={s} value={s}>{s}</option>
              )}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Fecha desde</label>
            <input type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setPage(0); }}
              className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
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

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-400 flex gap-2 items-center">
          {error}
        </div>
      )}

      <DataTable<OrdenListDto>
        columns={ORDEN_COLS}
        rows={rows}
        totalElements={total}
        totalPages={totalPages}
        page={page}
        size={size}
        sortBy={sortBy}
        sortDir={sortDir}
        isLoading={loading}
        emptyMessage="No hay órdenes para mostrar."
        onPageChange={setPage}
        onSizeChange={s => { setSize(s); setPage(0); }}
        onSortChange={handleSort}
        onRowClick={r => navigate(`/dropi/ordenes/${r.id}`)}
      />
    </div>
  );
}
