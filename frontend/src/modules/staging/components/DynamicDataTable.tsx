// ─── DynamicDataTable (modules/staging/components/DynamicDataTable.tsx) ──────
// Tabla completamente dinámica usando TanStack Table v8.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
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
} from "@tanstack/react-table";
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

function CellValue({ value, type }: { value: any; type: StagingColumnDef["type"] }) {
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
    <span className="block truncate max-w-[200px]" title={str}>
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
const PINNED_COLS = ["id", "rowNumber", "processingStatus"];

// ── Componente principal ──────────────────────────────────────────────────────

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
}: DynamicDataTableProps) {
  
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Construir columnas de TanStack Table
  const tableColumns = useMemo<ColumnDef<StagingRow>[]>(() => {
    return apiColumns.map((col) => ({
      id: col.key,
      accessorKey: col.key,
      header: col.label,
      cell: (info) => <CellValue value={info.getValue()} type={col.type} />,
      enableSorting: PINNED_COLS.includes(col.key) || col.type === "text", // Ejemplo de habilitar sort
      enableHiding: !PINNED_COLS.includes(col.key), // Las pinned no se pueden ocultar
    }));
  }, [apiColumns]);

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: {
      globalFilter,
      columnFilters,
      columnVisibility,
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    // Sorting se delega al servidor (manual)
    manualSorting: true,
    manualPagination: true,
  });

  const handleHeaderSort = (column: any) => {
    if (!column.getCanSort()) return;
    const newDir = serverSortBy === column.id && serverSortDir === "asc" ? "desc" : "asc";
    onSortChange(column.id, newDir);
  };

  const startRow = serverPage * serverSize + 1;
  const endRow   = Math.min((serverPage + 1) * serverSize, totalElements);

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Filtro global local */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(String(e.target.value))}
            placeholder="Buscar en esta página..."
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

        {/* Visibilidad de columnas */}
        <div className="relative">
          <ColVisibilityMenu table={table} apiColumns={apiColumns} />
        </div>

        {/* Selector de tamaño */}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>Filas por pág:</span>
          <select
            value={serverSize}
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
            <thead className="sticky top-0 z-[5] bg-muted/60 backdrop-blur border-b border-border">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const isSorted = serverSortBy === header.column.id;
                    return (
                      <th
                        key={header.id}
                        className={cn(
                          "whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground border-r border-border last:border-r-0 align-top"
                        )}
                      >
                        <div className="flex flex-col gap-1.5">
                          {/* Title & Sort */}
                          <div 
                            className={cn(
                              "flex items-center justify-between gap-2 select-none", 
                              header.column.getCanSort() && "cursor-pointer hover:text-foreground"
                            )}
                            onClick={() => handleHeaderSort(header.column)}
                          >
                            <span>
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </span>
                            {header.column.getCanSort() && (
                              <div className="w-3">
                                {isSorted ? (
                                  serverSortDir === "asc" ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />
                                ) : (
                                  <ChevronsUpDown className="h-3 w-3 opacity-40" />
                                )}
                              </div>
                            )}
                          </div>

                          {/* Column Filter */}
                          {header.column.getCanFilter() && (
                            <FilterInput column={header.column} />
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border/60">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={table.getVisibleFlatColumns().length} className="px-4 py-10 text-center text-muted-foreground">
                    No se encontraron resultados en esta página.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/20 transition-colors group">
                    {row.getVisibleCells().map((cell) => {
                      const isNumber = apiColumns.find((c) => c.key === cell.column.id)?.type === "number";
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "px-3 py-1.5 border-r border-border/40 last:border-r-0",
                            isNumber && "text-right"
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

      {/* ── Paginación Server-Side ─────────────────────────────────────────── */}
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
            disabled={serverPage === 0 || isLoading}
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline" size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(serverPage - 1)}
            disabled={serverPage === 0 || isLoading}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          <div className="flex items-center gap-0.5">
            {getPageNumbers(serverPage, totalPages).map((n, i) =>
              n === "..." ? (
                <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-muted-foreground">…</span>
              ) : (
                <button
                  key={n}
                  onClick={() => onPageChange(Number(n))}
                  disabled={isLoading}
                  className={cn(
                    "h-7 min-w-[28px] rounded-md px-2 text-xs transition-colors",
                    n === serverPage
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
            onClick={() => onPageChange(serverPage + 1)}
            disabled={serverPage >= totalPages - 1 || isLoading}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline" size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(totalPages - 1)}
            disabled={serverPage >= totalPages - 1 || isLoading}
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Column Filter Input ────────────────────────────────────────────────────────
function FilterInput({ column }: { column: any }) {
  const columnFilterValue = column.getFilterValue();
  const apiType = column.columnDef.id === "processingStatus" ? "status" : "text"; // Simplificado

  if (apiType === "status") {
    // Si queremos un select para status
    return (
      <select
        value={(columnFilterValue ?? "") as string}
        onChange={e => column.setFilterValue(e.target.value)}
        className="w-full rounded border border-border bg-background px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
      >
        <option value="">Todos</option>
        <option value="PENDING">PENDING</option>
        <option value="RUNNING">RUNNING</option>
        <option value="PROCESSED">PROCESSED</option>
        <option value="ERROR">ERROR</option>
      </select>
    );
  }

  return (
    <input
      type="text"
      value={(columnFilterValue ?? "") as string}
      onChange={e => column.setFilterValue(e.target.value)}
      placeholder={`Filtrar...`}
      className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-[10px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 font-normal"
    />
  );
}

// ── Menú de visibilidad de columnas ──────────────────────────────────────────
function ColVisibilityMenu({ table, apiColumns }: { table: any, apiColumns: StagingColumnDef[] }) {
  const [open, setOpen] = useState(false);
  const hiddenCount = table.getVisibleLeafColumns().length; // Para calcular cuántas ocultas
  const totalCols = table.getAllLeafColumns().length;
  const hidden = totalCols - hiddenCount;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1.5"
        onClick={() => setOpen((v) => !v)}
      >
        Columnas
        {hidden > 0 && (
          <span className="rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-[10px] font-medium">
            -{hidden}
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
            {table.getAllLeafColumns().map((column: any) => {
              const colDef = apiColumns.find(c => c.key === column.id);
              const pinned = PINNED_COLS.includes(column.id);
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
