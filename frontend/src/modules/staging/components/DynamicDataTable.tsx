// ─── DynamicDataTable (modules/staging/components/DynamicDataTable.tsx) ──────
// Tabla completamente dinámica: columnas y filas vienen del backend.
// Soporta: ordenamiento por columna, paginación, filtro global,
//          resaltado de celdas por tipo (status, number, datetime).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  X,
} from "lucide-react";
import type { StagingColumnDef, StagingRow } from "@/contracts/api.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ── Sub-componentes ───────────────────────────────────────────────────────────

interface SortState {
  key: string;
  dir: "asc" | "desc";
}

function SortIcon({ col, sort }: { col: string; sort: SortState | null }) {
  if (!sort || sort.key !== col) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
  return sort.dir === "asc"
    ? <ChevronUp className="h-3 w-3 text-primary" />
    : <ChevronDown className="h-3 w-3 text-primary" />;
}

function StatusBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const map: Record<string, string> = {
    PENDING:   "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    PROCESSED: "bg-green-500/10  text-green-400  border-green-500/30",
    ERROR:     "bg-red-500/10    text-red-400    border-red-500/30",
    RUNNING:   "bg-blue-500/10   text-blue-400   border-blue-500/30",
  };
  const cls = map[String(value).toUpperCase()] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider", cls)}>
      {value}
    </span>
  );
}

function CellValue({ value, type }: { value: string | number | null; type: StagingColumnDef["type"] }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/50">—</span>;
  }
  if (type === "status") return <StatusBadge value={String(value)} />;
  if (type === "number") {
    return (
      <span className="tabular-nums font-mono text-right block">
        {typeof value === "number" ? value.toLocaleString("es-CO") : value}
      </span>
    );
  }
  if (type === "datetime") {
    try {
      const d = new Date(String(value));
      return <span className="text-muted-foreground tabular-nums">{d.toLocaleString("es-CO")}</span>;
    } catch {
      return <span>{String(value)}</span>;
    }
  }
  const str = String(value);
  return (
    <span
      className="block truncate max-w-[200px]"
      title={str}
    >
      {str}
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface DynamicDataTableProps {
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
}

const PAGE_SIZES = [20, 50, 100, 200];

// ── Columnas fijadas al inicio (siempre visibles) ────────────────────────────
const PINNED_COLS = ["id", "rowNumber", "processingStatus"];

// ── Componente principal ──────────────────────────────────────────────────────

export function DynamicDataTable({
  columns,
  rows,
  totalElements,
  totalPages,
  page,
  size,
  sortBy,
  sortDir,
  isLoading,
  onPageChange,
  onSizeChange,
  onSortChange,
}: DynamicDataTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    () => new Set(columns.map((c) => c.key))
  );

  // Filtro local (sobre las filas de la página actual)
  const filteredRows = useMemo(() => {
    if (!globalFilter.trim()) return rows;
    const q = globalFilter.toLowerCase();
    return rows.filter((row) =>
      columns.some((col) => {
        const v = row[col.key];
        return v !== null && String(v).toLowerCase().includes(q);
      })
    );
  }, [rows, columns, globalFilter]);

  const visibleColumns = columns.filter((c) => visibleCols.has(c.key));

  const handleHeaderClick = (col: StagingColumnDef) => {
    if (col.type === "text" && !PINNED_COLS.includes(col.key)) return; // solo columns "sortables"
    const newDir = sortBy === col.key && sortDir === "asc" ? "desc" : "asc";
    onSortChange(col.key, newDir);
  };

  const toggleCol = (key: string) => {
    if (PINNED_COLS.includes(key)) return; // pinned → no se pueden ocultar
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const startRow = page * size + 1;
  const endRow   = Math.min((page + 1) * size, totalElements);

  return (
    <div className="flex flex-col gap-3">
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Filtro global */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Filtrar en esta página…"
            className="w-full rounded-md border border-border bg-muted/30 pl-8 pr-8 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {globalFilter && (
            <button
              onClick={() => setGlobalFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Selector de columnas */}
        <ColVisibilityMenu columns={columns} visible={visibleCols} onToggle={toggleCol} />

        {/* Selector tamaño de página */}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>Filas:</span>
          <select
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      <div className="relative rounded-lg border border-border overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}
        <div className="overflow-x-auto thin-scroll">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-[5]">
              <tr className="border-b border-border bg-muted/60 backdrop-blur">
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleHeaderClick(col)}
                    className={cn(
                      "whitespace-nowrap px-3 py-2.5 text-left font-medium text-muted-foreground select-none",
                      "border-r border-border last:border-r-0",
                      col.type === "number" && "text-right",
                      (PINNED_COLS.includes(col.key) || col.type !== "text") &&
                        "cursor-pointer hover:text-foreground hover:bg-muted/80 transition-colors"
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {(PINNED_COLS.includes(col.key) || col.type !== "text") && (
                        <SortIcon col={col.key} sort={sortBy ? { key: sortBy, dir: sortDir } : null} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-10 text-center text-muted-foreground">
                    {globalFilter ? "Sin resultados para el filtro aplicado." : "Sin filas de datos."}
                  </td>
                </tr>
              )}
              {filteredRows.map((row, ri) => (
                <tr
                  key={ri}
                  className="hover:bg-muted/20 transition-colors group"
                >
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-3 py-1.5 border-r border-border/40 last:border-r-0",
                        col.type === "number" && "text-right"
                      )}
                    >
                      <CellValue value={row[col.key] ?? null} type={col.type} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Paginación ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground tabular-nums">
          {totalElements === 0
            ? "Sin registros"
            : `Mostrando ${startRow.toLocaleString()}–${endRow.toLocaleString()} de ${totalElements.toLocaleString()} registros`}
        </p>

        <div className="flex items-center gap-1">
          <Button
            variant="outline" size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(0)}
            disabled={page === 0 || isLoading}
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline" size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0 || isLoading}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          {/* Números de página */}
          <div className="flex items-center gap-0.5">
            {getPageNumbers(page, totalPages).map((n, i) =>
              n === "..." ? (
                <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-muted-foreground">…</span>
              ) : (
                <button
                  key={n}
                  onClick={() => onPageChange(Number(n))}
                  disabled={isLoading}
                  className={cn(
                    "h-7 min-w-[28px] rounded-md px-2 text-xs transition-colors",
                    n === page
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {Number(n) + 1}
                </button>
              )
            )}
          </div>

          <Button
            variant="outline" size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1 || isLoading}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline" size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(totalPages - 1)}
            disabled={page >= totalPages - 1 || isLoading}
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Menú de visibilidad de columnas ──────────────────────────────────────────

function ColVisibilityMenu({
  columns,
  visible,
  onToggle,
}: {
  columns: StagingColumnDef[];
  visible: Set<string>;
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hiddenCount = columns.filter((c) => !PINNED_COLS.includes(c.key) && !visible.has(c.key)).length;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1.5"
        onClick={() => setOpen((v) => !v)}
      >
        Columnas
        {hiddenCount > 0 && (
          <span className="rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-[10px] font-medium">
            -{hiddenCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-30 mt-1.5 w-56 rounded-lg border border-border bg-popover shadow-lg p-2 max-h-72 overflow-y-auto thin-scroll">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Columnas visibles
            </p>
            {columns.map((col) => {
              const pinned = PINNED_COLS.includes(col.key);
              const isVisible = visible.has(col.key);
              return (
                <label
                  key={col.key}
                  className={cn(
                    "flex items-center gap-2 rounded px-2 py-1 text-xs cursor-pointer hover:bg-muted transition-colors",
                    pinned && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    disabled={pinned}
                    onChange={() => onToggle(col.key)}
                    className="accent-primary"
                  />
                  <span className={cn(!isVisible && "text-muted-foreground line-through")}>
                    {col.label}
                  </span>
                  {pinned && <span className="ml-auto text-[9px] text-muted-foreground">fija</span>}
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Helper: genera array de números de página con elipsis ─────────────────────

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const pages: (number | "...")[] = [];
  const add = (n: number | "...") => {
    if (pages[pages.length - 1] !== n) pages.push(n);
  };
  add(0);
  if (current > 3) add("...");
  for (let i = Math.max(1, current - 1); i <= Math.min(total - 2, current + 1); i++) add(i);
  if (current < total - 4) add("...");
  add(total - 1);
  return pages;
}
