// ─── ClientesPage (modules/dropi/ClientesPage.tsx) ───────────────────────────
import { useEffect, useState, useCallback, useRef } from "react";
import { RefreshCw, Search, X } from "lucide-react";
import { dropiService } from "./dropi.service";
import type { ClienteDto } from "@/contracts/api.types";
import { DataTable } from "@/components/data-table/DataTable";
import type { ColumnDef } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";

const NUM = new Intl.NumberFormat("es-CO");

const CLIENTE_COLS: ColumnDef<ClienteDto>[] = [
  { key: "nombre",            label: "Nombre",        type: "text",   pinned: true, minWidth: 150 },
  { key: "telefono",          label: "Teléfono",      type: "text" },
  { key: "email",             label: "Email",         type: "text" },
  { key: "tipoIdentificacion",label: "Tipo ID",       type: "text",   hidden: true },
  { key: "nroIdentificacion", label: "Nro. ID",       type: "text",   hidden: true },
  { key: "createdAt",         label: "Registrado",    type: "datetime", sortable: false,
    render: (v) => v ? <span className="text-muted-foreground tabular-nums">{String(v).slice(0, 10)}</span> : null },
];

export function ClientesPage() {
  const [q, setQ]               = useState("");
  const [page, setPage]         = useState(0);
  const [rows, setRows]         = useState<ClienteDto[]>([]);
  const [total, setTotal]       = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const debounce                = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (search: string, pg: number) => {
    setLoading(true);
    try {
      const res = await dropiService.listClientes(search || undefined, pg, 50);
      setRows(res.content);
      setTotal(res.totalElements);
      setTotalPages(res.totalPages);
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.message ?? "No se pudo cargar los clientes.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(q, page); }, [page]);

  const handleSearch = (val: string) => {
    setQ(val);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(0); load(val, 0); }, 350);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{NUM.format(total)} clientes registrados</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(q, page)} disabled={loading} className="h-8">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Búsqueda server-side */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input value={q} onChange={e => handleSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono, email…"
          className="w-full rounded-md border border-border bg-muted/30 pl-8 pr-7 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        {q && <button onClick={() => handleSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      <DataTable<ClienteDto>
        columns={CLIENTE_COLS}
        rows={rows}
        totalElements={total}
        totalPages={totalPages}
        page={page}
        size={50}
        isLoading={loading}
        emptyMessage="No se encontraron clientes."
        onPageChange={setPage}
        onSizeChange={() => {}}
      />
    </div>
  );
}
