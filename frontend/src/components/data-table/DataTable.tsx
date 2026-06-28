// ─── DataTable genérico (components/data-table/DataTable.tsx) ────────────────
//
// Tabla reutilizable con tipado genérico para cualquier módulo.
// Características:
//   • Columnas tipadas con render personalizado y badge de estado
//   • Paginación server-side con controles completos
//   • Ordenamiento server-side por columna
//   • Filtro global (búsqueda en página actual)
//   • Filtros por columna: text | status (multi-select) | date (rango)
//   • Visibilidad de columnas (hide/show)
//   • Exportación CSV: selección / página / todo
//   • onRowClick callback tipado
//   • Indicador de carga con overlay
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Search, X, Download, EyeOff, SlidersHorizontal,
  CheckSquare, CalendarRange, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════════

export type ColType = "text" | "number" | "currency" | "date" | "datetime" | "status" | "custom";

export interface ColumnDef<T> {
  key: keyof T | string;
  label: string;
  type?: ColType;
  sortable?: boolean;
  hidden?: boolean;          // oculta por defecto
  pinned?: boolean;          // no se puede ocultar
  minWidth?: number;
  render?: (value: unknown, row: T) => React.ReactNode;
}

export interface DataTableProps<T extends object> {
  columns: ColumnDef<T>[];
  rows: T[];
  rowKey?: keyof T;          // campo para key única — default "id"
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  isLoading?: boolean;
  emptyMessage?: string;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  onSortChange?: (key: string, dir: "asc" | "desc") => void;
  onRowClick?: (row: T) => void;
  /** Fetch ALL rows para exportar todo */
  onExportAll?: (onProgress: (loaded: number, total: number) => void) => Promise<T[]>;
}

const PAGE_SIZES = [20, 50, 100, 200];

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat("es-CO");

// ═══════════════════════════════════════════════════════════════════════════════
// COLORES DE ESTADO — mapa completo para estatus Dropi
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_COLORS: Record<string, string> = {
  // ── Entregado ─────────────────────────────────────────────────────────────
  ENTREGADO:            "bg-green-500/15   text-green-400    border-green-500/30",
  // ── En tránsito / intentos ────────────────────────────────────────────────
  "EN CAMINO":          "bg-blue-500/15    text-blue-400     border-blue-500/30",
  "INTENTO DE ENTREGA": "bg-yellow-500/15  text-yellow-400   border-yellow-500/30",
  "RECLAME EN OFICINA": "bg-yellow-500/15  text-yellow-400   border-yellow-500/30",
  PENDIENTE:            "bg-yellow-500/15  text-yellow-400   border-yellow-500/30",
  "EN CAMINO A DESTINO":"bg-blue-500/15    text-blue-400     border-blue-500/30",
  // ── Devolución ────────────────────────────────────────────────────────────
  DEVOLUCION:           "bg-red-500/15     text-red-400      border-red-500/30",
  DEVOLUCIÓN:           "bg-red-500/15     text-red-400      border-red-500/30",
  "EN DEVOLUCION":      "bg-red-500/15     text-red-400      border-red-500/30",
  // ── Cancelado / error ─────────────────────────────────────────────────────
  CANCELADO:            "bg-red-500/15     text-red-400      border-red-500/30",
  "CANCELADO CLIENTE":  "bg-red-500/15     text-red-400      border-red-500/30",
  // ── Novedad ───────────────────────────────────────────────────────────────
  NOVEDAD:              "bg-purple-500/15  text-purple-400   border-purple-500/30",
  "CON NOVEDAD":        "bg-purple-500/15  text-purple-400   border-purple-500/30",
  // ── Staging ───────────────────────────────────────────────────────────────
  PROCESSED:            "bg-green-500/15   text-green-400    border-green-500/30",
  PENDING:              "bg-yellow-500/15  text-yellow-400   border-yellow-500/30",
  RUNNING:              "bg-blue-500/15    text-blue-400     border-blue-500/30",
  ERROR:                "bg-red-500/15     text-red-400      border-red-500/30",
};

export function StatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground/50 select-none">—</span>;
  const upper = value.toUpperCase();
  const cls = STATUS_COLORS[upper] ?? "bg-muted/60 text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider whitespace-nowrap", cls)}>
      {value}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL — renderiza fuera de overflow para evitar clipping
// ═══════════════════════════════════════════════════════════════════════════════

function Portal({ triggerRef, open, onClose, align = "left", minWidth = 160, children }:
  { triggerRef: React.RefObject<HTMLElement | null>; open: boolean; onClose: () => void;
    align?: "left" | "right"; minWidth?: number; children: React.ReactNode }) {
  const [pos, setPos] = useState({ top: 0, left: 0, right: 0 });
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, right: window.innerWidth - r.right });
  }, [open, triggerRef]);
  if (!open) return null;
  return createPortal(
    <>
      <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={onClose} />
      <div style={{ position: "fixed", top: pos.top, ...(align === "right" ? { right: pos.right } : { left: pos.left }), minWidth, zIndex: 9999 }}
        className="rounded-lg border border-border bg-card shadow-2xl ring-1 ring-black/20">
        {children}
      </div>
    </>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

function esc(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCSV<T extends object>(
  filename: string, cols: ColumnDef<T>[], rows: T[]
) {
  const visibleCols = cols.filter(c => c.type !== "custom");
  const header = visibleCols.map(c => esc(c.label)).join(",");
  const body   = rows.map(r => visibleCols.map(c => esc(r[c.key as keyof T])).join(",")).join("\n");
  const blob   = new Blob(["\uFEFF" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement("a"); a.href = url;
  a.download   = filename; a.click(); URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CELL RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

function CellValue<T>({ col, value, row }: { col: ColumnDef<T>; value: unknown; row: T }) {
  if (col.render) return <>{col.render(value, row)}</>;
  if (value == null || value === "") return <span className="text-muted-foreground/40 select-none">—</span>;
  const s = String(value);
  switch (col.type) {
    case "status":   return <StatusBadge value={s} />;
    case "currency": return <span className="tabular-nums font-mono text-right block">{COP.format(Number(value))}</span>;
    case "number":   return <span className="tabular-nums font-mono text-right block">{NUM.format(Number(value))}</span>;
    case "datetime":
      try { return <span className="text-muted-foreground tabular-nums whitespace-nowrap">{new Date(s).toLocaleString("es-CO")}</span>; }
      catch { return <span>{s}</span>; }
    default: return <span className="block truncate max-w-[220px]" title={s}>{s}</span>;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILTRO DE COLUMNA
// ═══════════════════════════════════════════════════════════════════════════════

interface ColFilterProps {
  type: ColType;
  value: unknown;
  onChange: (v: unknown) => void;
  facetValues?: Map<string, number>;
}

function ColFilter({ type, value, onChange, facetValues }: ColFilterProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  if (type === "status") {
    const selected = (value as Set<string>) ?? new Set<string>();
    const opts = facetValues ? Array.from(facetValues.keys()).filter(Boolean) : [];
    const hasFilter = selected.size > 0;
    return (
      <>
        <button ref={triggerRef} onClick={() => setOpen(v => !v)}
          className={cn("flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] w-full transition-colors",
            hasFilter ? "border-primary/70 bg-primary/15 text-primary" : "border-border bg-background/80 text-muted-foreground hover:border-primary/40")}>
          <CheckSquare className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate flex-1 text-left">{hasFilter ? `${selected.size} activo${selected.size > 1 ? "s" : ""}` : "Filtrar…"}</span>
          {hasFilter && <X className="h-2.5 w-2.5 shrink-0" onClick={e => { e.stopPropagation(); onChange(undefined); setOpen(false); }} />}
        </button>
        <Portal triggerRef={triggerRef} open={open} onClose={() => setOpen(false)} minWidth={170}>
          <div className="p-1.5">
            <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Mostrar solo</p>
            {opts.length === 0 && <p className="px-2 py-1 text-[11px] text-muted-foreground italic">Sin valores</p>}
            {opts.map(opt => {
              const key = opt.toUpperCase();
              const checked = selected.has(key);
              return (
                <label key={opt} className="flex items-center gap-2 rounded px-2 py-1.5 text-[11px] cursor-pointer hover:bg-muted transition-colors">
                  <input type="checkbox" className="accent-primary h-3 w-3 cursor-pointer" checked={checked}
                    onChange={() => {
                      const next = new Set(selected);
                      checked ? next.delete(key) : next.add(key);
                      onChange(next.size > 0 ? next : undefined);
                    }} />
                  <StatusBadge value={opt} />
                  <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">{facetValues?.get(opt) ?? 0}</span>
                </label>
              );
            })}
            {hasFilter && <button className="w-full text-[10px] text-muted-foreground hover:text-primary border-t border-border mt-1 pt-1.5 text-center" onClick={() => { onChange(undefined); setOpen(false); }}>Limpiar</button>}
          </div>
        </Portal>
      </>
    );
  }

  if (type === "date" || type === "datetime") {
    const range = (value as { from: string; to: string }) ?? { from: "", to: "" };
    const hasFilter = !!(range.from || range.to);
    return (
      <>
        <button ref={triggerRef} onClick={() => setOpen(v => !v)}
          className={cn("flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] w-full transition-colors",
            hasFilter ? "border-primary/70 bg-primary/15 text-primary" : "border-border bg-background/80 text-muted-foreground hover:border-primary/40")}>
          <CalendarRange className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate flex-1 text-left">{hasFilter ? `${range.from || "?"} → ${range.to || "hoy"}` : "Rango…"}</span>
          {hasFilter && <X className="h-2.5 w-2.5 shrink-0" onClick={e => { e.stopPropagation(); onChange(undefined); setOpen(false); }} />}
        </button>
        <Portal triggerRef={triggerRef} open={open} onClose={() => setOpen(false)} minWidth={210}>
          <div className="p-3 space-y-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Rango de fechas</p>
            <div className="space-y-1"><label className="text-[10px] text-muted-foreground">Desde</label>
              <input type="date" value={range.from} onChange={e => onChange({ ...range, from: e.target.value })}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            <div className="space-y-1"><label className="text-[10px] text-muted-foreground">Hasta</label>
              <input type="date" value={range.to} onChange={e => onChange({ ...range, to: e.target.value })}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            {hasFilter && <button className="w-full text-[10px] text-muted-foreground hover:text-primary border-t border-border pt-1.5 text-center" onClick={() => { onChange(undefined); setOpen(false); }}>Limpiar rango</button>}
          </div>
        </Portal>
      </>
    );
  }

  // text / number
  const strVal = (value as string) ?? "";
  return (
    <div className="relative">
      <input type="text" value={strVal} onChange={e => onChange(e.target.value || undefined)} placeholder="Filtrar…"
        className="w-full rounded border border-border bg-background/80 px-1.5 pr-5 py-0.5 text-[10px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50" />
      {strVal && <button onClick={() => onChange(undefined)} className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-2.5 w-2.5" /></button>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MENÚ COLUMNAS
// ═══════════════════════════════════════════════════════════════════════════════

function ColVisMenu<T>({ cols, visibility, onToggle, onShowAll }:
  { cols: ColumnDef<T>[]; visibility: Record<string, boolean>;
    onToggle: (key: string) => void; onShowAll: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const hiddenCount = cols.filter(c => !c.pinned && visibility[String(c.key)] === false).length;
  return (
    <>
      <Button ref={ref} variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setOpen(v => !v)}>
        <EyeOff className="h-3.5 w-3.5" />Columnas
        {hiddenCount > 0 && <span className="rounded-full bg-primary/20 text-primary px-1.5 text-[10px] font-medium">-{hiddenCount}</span>}
      </Button>
      <Portal triggerRef={ref} open={open} onClose={() => setOpen(false)} align="right" minWidth={220}>
        <div className="p-2 max-h-80 overflow-y-auto">
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Columnas visibles</p>
            <button onClick={onShowAll} className="text-[10px] text-primary hover:underline">Mostrar todas</button>
          </div>
          {cols.filter(c => !c.pinned).map(c => {
            const key = String(c.key);
            const vis = visibility[key] !== false;
            return (
              <label key={key} className="flex items-center gap-2 rounded px-2 py-1 text-xs cursor-pointer hover:bg-muted transition-colors">
                <input type="checkbox" checked={vis} onChange={() => onToggle(key)} className="accent-primary" />
                <span className={cn(!vis && "text-muted-foreground line-through")}>{c.label}</span>
              </label>
            );
          })}
        </div>
      </Portal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MENÚ EXPORTAR
// ═══════════════════════════════════════════════════════════════════════════════

function ExportMenuBtn<T extends object>({
  cols, selected, currentRows, onExportAll
}: {
  cols: ColumnDef<T>[]; selected: T[]; currentRows: T[];
  onExportAll?: DataTableProps<T>["onExportAll"];
}) {
  const [open, setOpen]     = useState(false);
  const [exp, setExp]       = useState(false);
  const [prog, setProg]     = useState<{ l: number; t: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const now = () => new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");

  return (
    <>
      <Button ref={ref} variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={exp} onClick={() => setOpen(v => !v)}>
        {exp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {exp && prog ? `Exportando ${prog.l.toLocaleString()}…` : "Exportar"}
      </Button>
      <Portal triggerRef={ref} open={open && !exp} onClose={() => setOpen(false)} align="right" minWidth={210}>
        <div className="p-1.5">
          <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Exportar CSV</p>
          <button disabled={!selected.length} onClick={() => { if (!selected.length) return; downloadCSV(`datos-seleccion-${now()}.csv`, cols, selected); setOpen(false); }}
            className={cn("flex w-full items-center gap-2 rounded px-3 py-2 text-sm transition-colors", selected.length > 0 ? "hover:bg-muted text-foreground cursor-pointer" : "text-muted-foreground cursor-not-allowed opacity-40")}>
            <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-[13px]">Exportar selección {selected.length > 0 && `(${selected.length})`}</span>
          </button>
          <button onClick={() => { downloadCSV(`datos-pagina-${now()}.csv`, cols, currentRows); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted text-foreground cursor-pointer transition-colors">
            <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-[13px]">Exportar página actual</span>
          </button>
          {onExportAll && (
            <>
              <div className="my-1 border-t border-border" />
              <button onClick={async () => { setOpen(false); setExp(true); setProg({ l: 0, t: 0 });
                try { const all = await onExportAll((l, t) => setProg({ l, t })); downloadCSV(`datos-completo-${now()}.csv`, cols, all); }
                finally { setExp(false); setProg(null); }
              }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted text-foreground cursor-pointer transition-colors">
                <Download className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-[13px]">Exportar todo</span>
              </button>
            </>
          )}
        </div>
      </Portal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGINACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

function Pagination({ page, totalPages, totalElements, size, isLoading, onPageChange, onSizeChange }:
  { page: number; totalPages: number; totalElements: number; size: number;
    isLoading?: boolean; onPageChange: (p: number) => void; onSizeChange: (s: number) => void }) {
  const start = page * size + 1;
  const end   = Math.min((page + 1) * size, totalElements);
  const pages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const out: (number | "...")[] = [];
    const add = (n: number | "...") => { if (out[out.length - 1] !== n) out.push(n); };
    add(0);
    if (page > 3) add("...");
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) add(i);
    if (page < totalPages - 4) add("...");
    add(totalPages - 1);
    return out;
  }, [page, totalPages]);

  return (
    <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="tabular-nums">{totalElements === 0 ? "Sin registros" : `${NUM.format(start)}–${NUM.format(end)} de ${NUM.format(totalElements)}`}</span>
        <div className="flex items-center gap-1.5">
          <span>Filas:</span>
          <select value={size} onChange={e => onSizeChange(Number(e.target.value))}
            className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0 || isLoading} onClick={() => onPageChange(0)}><ChevronsLeft className="h-3.5 w-3.5" /></Button>
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0 || isLoading} onClick={() => onPageChange(page - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
        <div className="flex items-center gap-0.5">
          {pages.map((n, i) => n === "..." ? <span key={`e${i}`} className="px-1.5">…</span> : (
            <button key={n} onClick={() => onPageChange(Number(n))} disabled={isLoading}
              className={cn("h-7 min-w-[28px] rounded-md px-2 text-xs transition-colors", n === page ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground")}>
              {Number(n) + 1}
            </button>
          ))}
        </div>
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1 || isLoading} onClick={() => onPageChange(page + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1 || isLoading} onClick={() => onPageChange(totalPages - 1)}><ChevronsRight className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export function DataTable<T extends object>({
  columns,
  rows,
  rowKey = "id" as keyof T,
  totalElements,
  totalPages,
  page,
  size,
  sortBy,
  sortDir = "asc",
  isLoading,
  emptyMessage = "No se encontraron registros.",
  onPageChange,
  onSizeChange,
  onSortChange,
  onRowClick,
  onExportAll,
}: DataTableProps<T>) {
  // Visibilidad de columnas (inicializa desde col.hidden)
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(columns.filter(c => c.hidden).map(c => [String(c.key), false]))
  );

  // Filtros por columna: key → valor (string | Set<string> | {from,to})
  const [colFilters, setColFilters] = useState<Record<string, unknown>>({});

  // Filtro global
  const [globalFilter, setGlobalFilter] = useState("");

  // Selección
  const [selected, setSelected] = useState<Set<string | number>>(new Set());

  // Calcular facet values para columnas status (desde rows actuales)
  const facetValues = useMemo(() => {
    const result: Record<string, Map<string, number>> = {};
    columns.filter(c => c.type === "status").forEach(col => {
      const m = new Map<string, number>();
      rows.forEach(r => {
        const v = String(r[col.key as keyof T] ?? "");
        if (v) m.set(v, (m.get(v) ?? 0) + 1);
      });
      result[String(col.key)] = m;
    });
    return result;
  }, [columns, rows]);

  // Filtrar filas localmente
  const filteredRows = useMemo(() => {
    let data = rows;
    // Global
    if (globalFilter) {
      const q = globalFilter.toLowerCase();
      data = data.filter(row =>
        columns.some(c => String(row[c.key as keyof T] ?? "").toLowerCase().includes(q))
      );
    }
    // Por columna
    Object.entries(colFilters).forEach(([key, fval]) => {
      if (fval == null) return;
      const col = columns.find(c => String(c.key) === key);
      if (!col) return;
      if (fval instanceof Set) {
        data = data.filter(r => fval.has(String(r[key as keyof T] ?? "").toUpperCase()));
      } else if (typeof fval === "object" && "from" in (fval as object)) {
        const { from, to } = fval as { from: string; to: string };
        data = data.filter(r => {
          const raw = String(r[key as keyof T] ?? "");
          if (!raw) return false;
          const d = new Date(raw);
          if (isNaN(d.getTime())) return true;
          if (from && d < new Date(from)) return false;
          if (to) { const td = new Date(to); td.setHours(23, 59, 59); if (d > td) return false; }
          return true;
        });
      } else {
        const q = String(fval).toLowerCase();
        data = data.filter(r => String(r[key as keyof T] ?? "").toLowerCase().includes(q));
      }
    });
    return data;
  }, [rows, globalFilter, colFilters, columns]);

  const visibleCols = columns.filter(c => visibility[String(c.key)] !== false);
  const selectedRows = filteredRows.filter(r => selected.has(r[rowKey] as string | number));
  const allSelected = filteredRows.length > 0 && filteredRows.every(r => selected.has(r[rowKey] as string | number));
  const someSelected = filteredRows.some(r => selected.has(r[rowKey] as string | number)) && !allSelected;
  const activeFilterCount = Object.values(colFilters).filter(v => v != null).length + (globalFilter ? 1 : 0);

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected);
      filteredRows.forEach(r => next.delete(r[rowKey] as string | number));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filteredRows.forEach(r => next.add(r[rowKey] as string | number));
      setSelected(next);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} placeholder="Buscar en esta página…"
            className="w-full rounded-md border border-border bg-muted/30 pl-8 pr-7 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          {globalFilter && <button onClick={() => setGlobalFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
        </div>

        {activeFilterCount > 0 && (
          <span className="rounded-full bg-primary/15 text-primary border border-primary/30 px-2.5 py-0.5 text-xs font-medium">
            <SlidersHorizontal className="h-3 w-3 inline mr-1" />{activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""} activo{activeFilterCount > 1 ? "s" : ""}
          </span>
        )}
        {selected.size > 0 && (
          <span className="rounded-full bg-muted text-foreground border border-border px-2.5 py-0.5 text-xs font-medium">
            {selected.size} seleccionada{selected.size > 1 ? "s" : ""}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <ColVisMenu cols={columns} visibility={visibility}
            onToggle={key => setVisibility(v => ({ ...v, [key]: v[key] === false }))}
            onShowAll={() => setVisibility({})} />
          <ExportMenuBtn cols={visibleCols} selected={selectedRows} currentRows={filteredRows} onExportAll={onExportAll} />
        </div>
      </div>

      {/* Tabla */}
      <div className="relative rounded-lg border border-border overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-background/70 z-10 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-[5] bg-muted/90 border-b border-border">
              <tr>
                {/* Checkbox */}
                <th className="w-9 px-2.5 py-1.5 border-r border-border">
                  <input type="checkbox" className="accent-primary h-3.5 w-3.5 cursor-pointer block mx-auto"
                    checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll} />
                </th>
                {visibleCols.map(col => {
                  const key = String(col.key);
                  const isSorted = sortBy === key;
                  const kind = col.type === "status" ? "status" : (col.type === "date" || col.type === "datetime") ? "date" : "text";
                  return (
                    <th key={key} className="px-2.5 py-1.5 text-left font-medium text-muted-foreground border-r border-border last:border-r-0 align-top"
                      style={{ minWidth: col.minWidth ?? 80 }}>
                      <div className="flex flex-col gap-1.5">
                        <div className={cn("flex items-center justify-between gap-1.5 select-none whitespace-nowrap",
                          col.sortable !== false && onSortChange ? "cursor-pointer hover:text-foreground transition-colors" : "")}
                          onClick={() => { if (col.sortable !== false && onSortChange) onSortChange(key, sortBy === key && sortDir === "asc" ? "desc" : "asc"); }}>
                          <span className="truncate max-w-[130px]" title={col.label}>{col.label}</span>
                          {col.sortable !== false && onSortChange && (
                            <div className="w-3 shrink-0">
                              {isSorted ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />) : <ChevronsUpDown className="h-3 w-3 opacity-30" />}
                            </div>
                          )}
                        </div>
                        {col.type !== "custom" && (
                          <ColFilter type={kind as ColType} value={colFilters[key]}
                            onChange={v => setColFilters(f => ({ ...f, [key]: v }))}
                            facetValues={facetValues[key]} />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredRows.length === 0 ? (
                <tr><td colSpan={visibleCols.length + 1} className="px-4 py-12 text-center text-sm text-muted-foreground">{emptyMessage}</td></tr>
              ) : (
                filteredRows.map(row => {
                  const rk = row[rowKey] as string | number;
                  const isSelected = selected.has(rk);
                  return (
                    <tr key={rk}
                      onClick={() => onRowClick?.(row)}
                      className={cn("transition-colors", isSelected ? "bg-primary/8 hover:bg-primary/10" : "hover:bg-muted/20", onRowClick && "cursor-pointer")}>
                      <td className="px-2.5 py-1.5 border-r border-border/30 text-center" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="accent-primary h-3.5 w-3.5 cursor-pointer block mx-auto"
                          checked={isSelected} onChange={() => setSelected(s => { const n = new Set(s); isSelected ? n.delete(rk) : n.add(rk); return n; })} />
                      </td>
                      {visibleCols.map(col => {
                        const key = String(col.key);
                        const val = row[col.key as keyof T];
                        return (
                          <td key={key} className={cn("px-2.5 py-1.5 border-r border-border/30 last:border-r-0",
                            (col.type === "number" || col.type === "currency") && "text-right")}>
                            <CellValue col={col} value={val} row={row} />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      <Pagination page={page} totalPages={totalPages} totalElements={totalElements}
        size={size} isLoading={isLoading} onPageChange={onPageChange} onSizeChange={onSizeChange} />
    </div>
  );
}

