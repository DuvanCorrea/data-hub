// ─── ClientesPage (modules/dropi/ClientesPage.tsx) ───────────────────────────
import { useEffect, useState, useCallback, useRef } from "react";
import { Search, X, Users, RefreshCw, AlertTriangle } from "lucide-react";
import { dropiService } from "./dropi.service";
import type { ClienteDto } from "@/contracts/api.types";
import { Button } from "@/components/ui/button";

const NUM = new Intl.NumberFormat("es-CO");

export function ClientesPage() {
  const [q, setQ]             = useState("");
  const [page, setPage]       = useState(0);
  const [rows, setRows]       = useState<ClienteDto[]>([]);
  const [total, setTotal]     = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const debounce              = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => { load(q, page); }, [page]);  // página cambia → recarga inmediata

  const handleSearch = (val: string) => {
    setQ(val);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(0); load(val, 0); }, 350);
  };

  const start = page * 50 + 1;
  const end   = Math.min((page + 1) * 50, total);

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

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input value={q} onChange={e => handleSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono, email…"
          className="w-full rounded-md border border-border bg-muted/30 pl-8 pr-7 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        {q && <button onClick={() => handleSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
      </div>

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
        {!loading && rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Users className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No se encontraron clientes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/80 border-b border-border">
                <tr>
                  {["Nombre","Teléfono","Email","Tipo ID","Nro. ID","Registrado"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap border-r border-border last:border-r-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rows.map(c => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 font-medium">{c.nombre ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">{c.telefono ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.email ?? "—"}</td>
                    <td className="px-3 py-2">{c.tipoIdentificacion ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">{c.nroIdentificacion ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{c.createdAt ? c.createdAt.slice(0, 10) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación simple */}
      {total > 50 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{NUM.format(start)}–{NUM.format(end)} de {NUM.format(total)}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 px-2" disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= totalPages - 1 || loading} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
}
