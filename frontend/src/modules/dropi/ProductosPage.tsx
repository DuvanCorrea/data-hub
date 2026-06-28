// ─── ProductosPage (modules/dropi/ProductosPage.tsx) ─────────────────────────
import { useEffect, useState } from "react";
import { Tag, RefreshCw, AlertTriangle } from "lucide-react";
import { dropiService } from "./dropi.service";
import type { ProductoDto } from "@/contracts/api.types";
import { Button } from "@/components/ui/button";

const NUM = new Intl.NumberFormat("es-CO");

export function ProductosPage() {
  const [rows, setRows]       = useState<ProductoDto[]>([]);
  const [total, setTotal]     = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = async (pg = page) => {
    setLoading(true);
    try {
      const res = await dropiService.listProductos(pg, 50);
      setRows(res.content);
      setTotal(res.totalElements);
      setTotalPages(res.totalPages);
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.message ?? "No se pudo cargar los productos.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(page); }, [page]);

  const start = page * 50 + 1;
  const end   = Math.min((page + 1) * 50, total);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {NUM.format(total)} productos en catálogo
            {total === 0 && " — requiere subir archivos de tipo Órdenes por Producto"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load()} disabled={loading} className="h-8">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-400 flex gap-2 items-center">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <div className="relative rounded-lg border border-border overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-background/70 z-10 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}
        {!loading && rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Tag className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Sin productos. Sube un archivo de Órdenes por Producto.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/80 border-b border-border">
                <tr>
                  {["SKU","Nombre del producto","ID Dropi","Unidades vendidas","Órdenes"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap border-r border-border last:border-r-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rows.map(p => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{p.sku ?? "—"}</td>
                    <td className="px-3 py-2 font-medium max-w-[280px] truncate" title={p.nombre ?? ""}>{p.nombre ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{p.productoIdDropi ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-center font-medium text-emerald-400">{NUM.format(p.qtyTotal)}</td>
                    <td className="px-3 py-2 tabular-nums text-center">{NUM.format(p.ordenesCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
