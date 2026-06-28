// ─── DynamicDataTable (modules/staging/components/DynamicDataTable.tsx) ──────
//
// Tabla de datos genérica para visualizar cualquier plantilla de importación.
//
// ARQUITECTURA DE DROPDOWNS:
//   Todos los popovers (filtro status, rango fecha, columnas, exportar) se
//   renderizan via createPortal en document.body para evitar el clipping que
//   produce el overflow-hidden del contenedor de la tabla.
//
// FILTROS POR TIPO DE COLUMNA:
//   "status"  → multi-select (checkboxes) — para type="status" y key~"estatus"
//   "date"    → rango inicio/fin          — para type="datetime" y key~"fecha"
//   "text"    → búsqueda libre            — resto de columnas
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  ColumnDef,
  flexRender,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
  FilterFn,
  Column,
} from "@tanstack/react-table";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Loader2,
  EyeOff,
  CheckSquare,
  Search,
  X,
  CalendarRange,
  SlidersHorizontal,
} from "lucide-react";
import type { StagingColumnDef, StagingRow } from "@/contracts/api.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DynamicDataTableProps {
  columns: StagingColumnDef[];
  rows: StagingRow[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  onSortChange: (key: string, dir: "asc" | "desc") => void;
  onExportAll?: (onProgress: (loaded: number, total: number) => void) => Promise<StagingRow[]>;
}

interface DateRangeFilter {
  from: string;
  to: string;
}

type FilterKind = "status" | "date" | "text";

const PAGE_SIZES = [20, 50, 100, 200];
const PINNED_COLS = new Set(["id", "rowNumber", "processingStatus"]);
const SELECT_COL_ID = "__select__";

// ═══════════════════════════════════════════════════════════════════════════════
// DETECCIÓN DE TIPO DE FILTRO
// ═══════════════════════════════════════════════════════════════════════════════

function getFilterKind(col: StagingColumnDef): FilterKind {
  if (col.type === "status") return "status";
  if (col.type === "datetime") return "date";
  // Columnas de texto con valores de estado (ej: estatus de la orden)
  if (col.type === "text" && /^estatus$/i.test(col.key)) return "status";
  // Columnas de texto que contienen fechas por nombre de campo
  if (col.type === "text" && /fecha/i.test(col.key)) return "date";
  return "text";
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function downloadCSV(filename: string, columns: StagingColumnDef[], rows: StagingRow[]) {
  const headers = columns.map((c) => escapeCSV(c.label)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCSV(row[c.key])).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + headers + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSEO DE FECHAS (múltiples formatos Dropi)
// ═══════════════════════════════════════════════════════════════════════════════

function parseFlexibleDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // ISO / YYYY-MM-DD
  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // DD-MM-YYYY o DD/MM/YYYY
  const m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (m) {
    d = new Date(`${m[3]}-${m[2]}-${m[1]}`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

const dateRangeFilterFn: FilterFn<StagingRow> = (row, columnId, filterValue: DateRangeFilter) => {
  const { from, to } = filterValue ?? {};
  if (!from && !to) return true;
  const raw = row.getValue<string | null>(columnId);
  if (!raw) return false;
  const date = parseFlexibleDate(String(raw));
  if (!date) return true;
  if (from && date < new Date(from)) return false;
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    if (date > toDate) return false;
  }
  return true;
};
dateRangeFilterFn.autoRemove = (val: DateRangeFilter) => !val?.from && !val?.to;

const multiSelectFilterFn: FilterFn<StagingRow> = (row, columnId, filterValue: Set<string>) => {
  if (!filterValue || filterValue.size === 0) return true;
  const val = row.getValue<string | null>(columnId);
  return filterValue.has(String(val ?? "").toUpperCase());
};
multiSelectFilterFn.autoRemove = (val: Set<string>) => !val || val.size === 0;

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL DE DROPDOWN — se renderiza en document.body para escapar overflow
// ═══════════════════════════════════════════════════════════════════════════════

interface DropdownPortalProps {
  triggerRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  align?: "left" | "right";
  minWidth?: number;
  children: React.ReactNode;
}

function DropdownPortal({
  triggerRef,
  open,
  onClose,
  align = "left",
  minWidth = 160,
  children,
}: DropdownPortalProps) {
  const [pos, setPos] = useState({ top: 0, left: 0, right: 0 });

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({
      top: r.bottom + 4,
      left: r.left,
      right: window.innerWidth - r.right,
    });
  }, [open, triggerRef]);

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop invisible para cerrar al hacer click afuera */}
      <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={onClose} />
      {/* Dropdown */}
      <div
        style={{
          position: "fixed",
          top: pos.top,
          ...(align === "right" ? { right: pos.right } : { left: pos.left }),
          minWidth,
          zIndex: 9999,
        }}
        className="rounded-lg border border-border bg-card text-card-foreground shadow-2xl ring-1 ring-black/20"
      >
        {children}
      </div>
    </>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_COLORS: Record<string, string> = {
  PENDING:    "bg-yellow-500/15 text-yellow-400  border-yellow-500/30",
  PROCESSED:  "bg-green-500/15  text-green-400   border-green-500/30",
  ERROR:      "bg-red-500/15    text-red-400     border-red-500/30",
  RUNNING:    "bg-blue-500/15   text-blue-400    border-blue-500/30",
  ENTREGADO:  "bg-green-500/15  text-green-400   border-green-500/30",
  DEVOLUCION: "bg-orange-500/15 text-orange-400  border-orange-500/30",
  CANCELADO:  "bg-red-500/15    text-red-400     border-red-500/30",
};

function StatusBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground/50 select-none">—</span>;
  const upper = String(value).toUpperCase();
  const cls = STATUS_COLORS[upper] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider whitespace-nowrap",
      cls
    )}>
      {value}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CELL VALUE RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

function CellValue({ value, type }: { value: unknown; type: StagingColumnDef["type"] }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/30 select-none">—</span>;
  }
  if (type === "status") return <StatusBadge value={String(value)} />;
  if (type === "number") {
    return (
      <span className="tabular-nums font-mono text-right block">
        {typeof value === "number" ? value.toLocaleString("es-CO") : String(value)}
      </span>
    );
  }
  if (type === "datetime") {
    try {
      return <span className="text-muted-foreground tabular-nums whitespace-nowrap">{new Date(String(value)).toLocaleString("es-CO")}</span>;
    } catch { return <span>{String(value)}</span>; }
  }
  const str = String(value);
  return <span className="block truncate max-w-[220px]" title={str}>{str}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILTRO POR COLUMNA
// ═══════════════════════════════════════════════════════════════════════════════

function ColumnFilterWidget({
  column,
  kind,
  facetValues,
}: {
  column: Column<StagingRow, unknown>;
  kind: FilterKind;
  facetValues: Map<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // ── Filtro multi-select (status) ──────────────────────────────────────────
  if (kind === "status") {
    const selected: Set<string> = (column.getFilterValue() as Set<string>) ?? new Set();
    const options = Array.from(facetValues.keys()).filter(Boolean);
    const hasFilter = selected.size > 0;

    return (
      <>
        <button
          ref={triggerRef}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] w-full transition-colors",
            hasFilter
              ? "border-primary/70 bg-primary/15 text-primary"
              : "border-border bg-background/80 text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          <CheckSquare className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate flex-1 text-left">
            {hasFilter ? `${selected.size} activo${selected.size > 1 ? "s" : ""}` : "Filtrar…"}
          </span>
          {hasFilter && (
            <X
              className="h-2.5 w-2.5 shrink-0 hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); column.setFilterValue(undefined); setOpen(false); }}
            />
          )}
        </button>

        <DropdownPortal triggerRef={triggerRef} open={open} onClose={() => setOpen(false)} minWidth={170}>
          <div className="p-1.5">
            <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mostrar solo
            </p>
            {options.length === 0 && (
              <p className="px-2 py-1 text-[11px] text-muted-foreground italic">Sin valores</p>
            )}
            {options.map((opt) => {
              const key = opt.toUpperCase();
              const checked = selected.has(key);
              return (
                <label
                  key={opt}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-[11px] cursor-pointer hover:bg-muted transition-colors"
                >
                  <input
                    type="checkbox"
                    className="accent-primary h-3 w-3 cursor-pointer"
                    checked={checked}
                    onChange={() => {
                      const next = new Set(selected);
                      checked ? next.delete(key) : next.add(key);
                      column.setFilterValue(next.size > 0 ? next : undefined);
                    }}
                  />
                  <StatusBadge value={opt} />
                  <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                    {facetValues.get(opt) ?? 0}
                  </span>
                </label>
              );
            })}
            {hasFilter && (
              <button
                className="w-full text-[10px] text-muted-foreground hover:text-primary border-t border-border mt-1 pt-1.5 pb-0.5 text-center transition-colors"
                onClick={() => { column.setFilterValue(undefined); setOpen(false); }}
              >
                Limpiar filtro
              </button>
            )}
          </div>
        </DropdownPortal>
      </>
    );
  }

  // ── Filtro rango de fechas ─────────────────────────────────────────────────
  if (kind === "date") {
    const range: DateRangeFilter = (column.getFilterValue() as DateRangeFilter) ?? { from: "", to: "" };
    const hasFilter = !!(range.from || range.to);

    return (
      <>
        <button
          ref={triggerRef}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] w-full transition-colors",
            hasFilter
              ? "border-primary/70 bg-primary/15 text-primary"
              : "border-border bg-background/80 text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          <CalendarRange className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate flex-1 text-left">
            {hasFilter
              ? `${range.from || "cualquier"} → ${range.to || "hoy"}`
              : "Rango fechas…"}
          </span>
          {hasFilter && (
            <X
              className="h-2.5 w-2.5 shrink-0 hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); column.setFilterValue(undefined); setOpen(false); }}
            />
          )}
        </button>

        <DropdownPortal triggerRef={triggerRef} open={open} onClose={() => setOpen(false)} minWidth={210}>
          <div className="p-3 space-y-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Rango de fechas
            </p>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Desde</label>
              <input
                type="date"
                value={range.from}
                onChange={(e) => column.setFilterValue({ ...range, from: e.target.value })}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Hasta</label>
              <input
                type="date"
                value={range.to}
                onChange={(e) => column.setFilterValue({ ...range, to: e.target.value })}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            {hasFilter && (
              <button
                className="w-full text-[10px] text-muted-foreground hover:text-primary border-t border-border pt-2 text-center transition-colors"
                onClick={() => { column.setFilterValue(undefined); setOpen(false); }}
              >
                Limpiar rango
              </button>
            )}
          </div>
        </DropdownPortal>
      </>
    );
  }

  // ── Filtro de texto ───────────────────────────────────────────────────────
  const value = (column.getFilterValue() as string) ?? "";
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => column.setFilterValue(e.target.value || undefined)}
        placeholder="Filtrar…"
        className="w-full rounded border border-border bg-background/80 px-1.5 pr-5 py-0.5 text-[10px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
      {value && (
        <button
          onClick={() => column.setFilterValue(undefined)}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MENÚ VISIBILIDAD DE COLUMNAS
// ═══════════════════════════════════════════════════════════════════════════════

function ColVisibilityMenu({
  table,
  apiColumns,
}: {
  table: ReturnType<typeof useReactTable<StagingRow>>;
  apiColumns: StagingColumnDef[];
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const allCols = table.getAllLeafColumns().filter((c) => c.id !== SELECT_COL_ID);
  const hiddenCount = allCols.filter((c) => !c.getIsVisible()).length;

  return (
    <>
      <Button
        ref={triggerRef}
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1.5"
        onClick={() => setOpen((v) => !v)}
      >
        <EyeOff className="h-3.5 w-3.5" />
        Columnas
        {hiddenCount > 0 && (
          <span className="rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-[10px] font-medium">
            -{hiddenCount}
          </span>
        )}
      </Button>

      <DropdownPortal
        triggerRef={triggerRef}
        open={open}
        onClose={() => setOpen(false)}
        align="right"
        minWidth={220}
      >
        <div className="p-2 max-h-80 overflow-y-auto">
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Columnas visibles
            </p>
            <button
              onClick={() => table.toggleAllColumnsVisible(true)}
              className="text-[10px] text-primary hover:underline"
            >
              Mostrar todas
            </button>
          </div>
          {allCols.map((column) => {
            const colDef = apiColumns.find((c) => c.key === column.id);
            const pinned = PINNED_COLS.has(column.id);
            return (
              <label
                key={column.id}
                className={cn(
                  "flex items-center gap-2 rounded px-2 py-1 text-xs cursor-pointer hover:bg-muted transition-colors",
                  pinned && "opacity-50 cursor-not-allowed"
                )}
              >
                <input
                  type="checkbox"
                  checked={column.getIsVisible()}
                  onChange={column.getToggleVisibilityHandler()}
                  disabled={pinned}
                  className="accent-primary"
                />
                <span className={cn(!column.getIsVisible() && "text-muted-foreground line-through")}>
                  {colDef?.label ?? column.id}
                </span>
                {pinned && <span className="ml-auto text-[9px] text-muted-foreground">fija</span>}
              </label>
            );
          })}
        </div>
      </DropdownPortal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MENÚ EXPORTAR
// ═══════════════════════════════════════════════════════════════════════════════

function ExportMenu({
  visibleColumns,
  selectedRows,
  currentPageRows,
  onExportAll,
}: {
  visibleColumns: StagingColumnDef[];
  selectedRows: StagingRow[];
  currentPageRows: StagingRow[];
  onExportAll?: DynamicDataTableProps["onExportAll"];
}) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const now = () => new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");

  const handleExportSelection = () => {
    if (!selectedRows.length) return;
    downloadCSV(`registros-seleccion-${now()}.csv`, visibleColumns, selectedRows);
    setOpen(false);
  };

  const handleExportPage = () => {
    downloadCSV(`registros-pagina-${now()}.csv`, visibleColumns, currentPageRows);
    setOpen(false);
  };

  const handleExportAll = async () => {
    if (!onExportAll) return;
    setOpen(false);
    setExporting(true);
    setProgress({ loaded: 0, total: 0 });
    try {
      const all = await onExportAll((loaded, total) => setProgress({ loaded, total }));
      downloadCSV(`registros-completo-${now()}.csv`, visibleColumns, all);
    } finally {
      setExporting(false);
      setProgress(null);
    }
  };

  return (
    <>
      <Button
        ref={triggerRef}
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1.5"
        disabled={exporting}
        onClick={() => setOpen((v) => !v)}
      >
        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {exporting && progress ? `Exportando ${progress.loaded.toLocaleString()}…` : "Exportar"}
      </Button>

      <DropdownPortal
        triggerRef={triggerRef}
        open={open && !exporting}
        onClose={() => setOpen(false)}
        align="right"
        minWidth={210}
      >
        <div className="p-1.5">
          <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Exportar CSV
          </p>

          <button
            className={cn(
              "flex w-full items-center gap-2 rounded px-3 py-2 text-sm transition-colors",
              selectedRows.length > 0
                ? "hover:bg-muted text-foreground cursor-pointer"
                : "text-muted-foreground cursor-not-allowed opacity-40"
            )}
            disabled={!selectedRows.length}
            onClick={handleExportSelection}
          >
            <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
            <span className="flex-1 text-left text-[13px]">
              Exportar selección
              {selectedRows.length > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({selectedRows.length})
                </span>
              )}
            </span>
          </button>

          <button
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted text-foreground cursor-pointer transition-colors"
            onClick={handleExportPage}
          >
            <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-[13px]">Exportar página actual</span>
          </button>

          {onExportAll && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted text-foreground cursor-pointer transition-colors"
                onClick={handleExportAll}
              >
                <Download className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-[13px]">Exportar todo</span>
              </button>
            </>
          )}
        </div>
      </DropdownPortal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGINACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

function Pagination({
  page, totalPages, totalElements, size, isLoading, onPageChange, onSizeChange,
}: {
  page: number; totalPages: number; totalElements: number; size: number;
  isLoading?: boolean; onPageChange: (p: number) => void; onSizeChange: (s: number) => void;
}) {
  const start = page * size + 1;
  const end = Math.min((page + 1) * size, totalElements);

  return (
    <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {totalElements === 0
            ? "Sin registros"
            : `${start.toLocaleString("es-CO")}–${end.toLocaleString("es-CO")} de ${totalElements.toLocaleString("es-CO")} registros`}
        </span>
        <div className="flex items-center gap-1.5">
          <span>Filas:</span>
          <select
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPageChange(0)} disabled={page === 0 || isLoading}>
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPageChange(page - 1)} disabled={page === 0 || isLoading}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        <div className="flex items-center gap-0.5">
          {getPageNumbers(page, totalPages).map((n, i) =>
            n === "..." ? (
              <span key={`e${i}`} className="px-1.5 text-xs text-muted-foreground">…</span>
            ) : (
              <button
                key={n}
                onClick={() => onPageChange(Number(n))}
                disabled={isLoading}
                className={cn(
                  "h-7 min-w-[28px] rounded-md px-2 text-xs transition-colors",
                  n === page ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {Number(n) + 1}
              </button>
            )
          )}
        </div>

        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1 || isLoading}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPageChange(totalPages - 1)} disabled={page >= totalPages - 1 || isLoading}>
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export function DynamicDataTable({
  columns: apiColumns,
  rows,
  totalElements,
  totalPages,
  page: serverPage,
  size: serverSize,
  sortBy: serverSortBy,
  sortDir: serverSortDir,
  isLoading,
  onPageChange,
  onSizeChange,
  onSortChange,
  onExportAll,
}: DynamicDataTableProps) {
  const [globalFilter, setGlobalFilter]         = useState("");
  const [columnFilters, setColumnFilters]       = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection]         = useState<RowSelectionState>({});

  // Reset filtros locales al cambiar de plantilla
  useEffect(() => {
    setColumnFilters([]);
    setGlobalFilter("");
    setRowSelection({});
  }, [apiColumns]);

  const filterKinds = useMemo(
    () => new Map(apiColumns.map((c) => [c.key, getFilterKind(c)])),
    [apiColumns]
  );

  // ── Construcción columnas TanStack ─────────────────────────────────────────
  const tableColumns = useMemo<ColumnDef<StagingRow>[]>(() => {
    const selectCol: ColumnDef<StagingRow> = {
      id: SELECT_COL_ID,
      header: ({ table }) => (
        <input
          type="checkbox"
          className="accent-primary h-3.5 w-3.5 cursor-pointer block mx-auto"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => { if (el) el.indeterminate = table.getIsSomePageRowsSelected(); }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="accent-primary h-3.5 w-3.5 cursor-pointer block mx-auto"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      enableColumnFilter: false,
      size: 36,
    };

    const dataCols: ColumnDef<StagingRow>[] = apiColumns.map((col) => ({
      id: col.key,
      accessorKey: col.key,
      header: col.label,
      cell: (info) => <CellValue value={info.getValue()} type={col.type} />,
      enableSorting: true,
      enableHiding: !PINNED_COLS.has(col.key),
      enableColumnFilter: true,
      filterFn:
        filterKinds.get(col.key) === "status"
          ? multiSelectFilterFn
          : filterKinds.get(col.key) === "date"
          ? dateRangeFilterFn
          : "includesString",
    }));

    return [selectCol, ...dataCols];
  }, [apiColumns, filterKinds]);

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: { globalFilter, columnFilters, columnVisibility, rowSelection },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    enableRowSelection: true,
    manualSorting: true,
    manualPagination: true,
  });

  const handleHeaderSort = (colId: string) => {
    onSortChange(colId, serverSortBy === colId && serverSortDir === "asc" ? "desc" : "asc");
  };

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const visibleApiCols = apiColumns.filter((c) => table.getColumn(c.key)?.getIsVisible() !== false);
  const activeFilterCount = columnFilters.length + (globalFilter ? 1 : 0);

  return (
    <div className="flex flex-col gap-3 animate-fade-in">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Búsqueda global */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Buscar en esta página…"
            className="w-full rounded-md border border-border bg-muted/30 pl-8 pr-7 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {globalFilter && (
            <button onClick={() => setGlobalFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Indicadores activos */}
        {activeFilterCount > 0 && (
          <span className="rounded-full bg-primary/15 text-primary border border-primary/30 px-2.5 py-0.5 text-xs font-medium">
            <SlidersHorizontal className="h-3 w-3 inline mr-1" />
            {activeFilterCount} {activeFilterCount === 1 ? "filtro activo" : "filtros activos"}
          </span>
        )}
        {selectedRows.length > 0 && (
          <span className="rounded-full bg-muted text-foreground border border-border px-2.5 py-0.5 text-xs font-medium">
            {selectedRows.length} {selectedRows.length === 1 ? "fila seleccionada" : "filas seleccionadas"}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <ColVisibilityMenu table={table} apiColumns={apiColumns} />
          <ExportMenu
            visibleColumns={visibleApiCols}
            selectedRows={selectedRows}
            currentPageRows={table.getFilteredRowModel().rows.map((r) => r.original)}
            onExportAll={onExportAll}
          />
        </div>
      </div>

      {/* ── Tabla ───────────────────────────────────────────────────────────── */}
      <div className="relative rounded-lg border border-border overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-background/70 z-10 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-[5] bg-muted/90 border-b border-border">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => {
                    const isSelectCol = header.column.id === SELECT_COL_ID;
                    const isSorted = serverSortBy === header.column.id;
                    const kind = filterKinds.get(header.column.id);
                    const facetValues: Map<string, number> =
                      !isSelectCol && kind === "status"
                        ? (() => { try { return header.column.getFacetedUniqueValues() ?? new Map(); } catch { return new Map(); } })()
                        : new Map();

                    return (
                      <th
                        key={header.id}
                        className="px-2.5 py-1.5 text-left font-medium text-muted-foreground border-r border-border last:border-r-0 align-top"
                        style={{ width: isSelectCol ? 36 : undefined, minWidth: isSelectCol ? 36 : 80 }}
                      >
                        {isSelectCol ? (
                          flexRender(header.column.columnDef.header, header.getContext())
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {/* Título + sort */}
                            <div
                              className="flex items-center justify-between gap-1.5 select-none whitespace-nowrap cursor-pointer hover:text-foreground transition-colors"
                              onClick={() => handleHeaderSort(header.column.id)}
                            >
                              <span className="truncate max-w-[130px]" title={String(header.column.columnDef.header)}>
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </span>
                              <div className="w-3 shrink-0">
                                {isSorted
                                  ? serverSortDir === "asc"
                                    ? <ChevronUp className="h-3 w-3 text-primary" />
                                    : <ChevronDown className="h-3 w-3 text-primary" />
                                  : <ChevronsUpDown className="h-3 w-3 opacity-30" />}
                              </div>
                            </div>

                            {/* Filtro */}
                            {kind && (
                              <ColumnFilterWidget
                                column={header.column}
                                kind={kind}
                                facetValues={facetValues}
                              />
                            )}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            <tbody className="divide-y divide-border/50">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={table.getVisibleLeafColumns().length} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No se encontraron resultados con los filtros actuales.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "hover:bg-muted/20 transition-colors",
                      row.getIsSelected() && "bg-primary/8 hover:bg-primary/10"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isSelect = cell.column.id === SELECT_COL_ID;
                      const colType = apiColumns.find((c) => c.key === cell.column.id)?.type;
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "px-2.5 py-1.5 border-r border-border/30 last:border-r-0",
                            isSelect && "text-center",
                            colType === "number" && "text-right"
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Paginación ──────────────────────────────────────────────────────── */}
      <Pagination
        page={serverPage}
        totalPages={totalPages}
        totalElements={totalElements}
        size={serverSize}
        isLoading={isLoading}
        onPageChange={onPageChange}
        onSizeChange={onSizeChange}
      />
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────
function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const pages: (number | "...")[] = [];
  const add = (n: number | "...") => { if (pages[pages.length - 1] !== n) pages.push(n); };
  add(0);
  if (current > 3) add("...");
  for (let i = Math.max(1, current - 1); i <= Math.min(total - 2, current + 1); i++) add(i);
  if (current < total - 4) add("...");
  add(total - 1);
  return pages;
}
