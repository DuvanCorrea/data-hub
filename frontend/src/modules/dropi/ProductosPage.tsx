// ─── ProductosPage (modules/dropi/ProductosPage.tsx) ─────────────────────────
import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { dropiService } from "./dropi.service";
import type { ProductoDto, ProductoVariacionDto } from "@/contracts/api.types";
import { DataTable } from "@/components/data-table/DataTable";
import type { ColumnDef } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const NUM = new Intl.NumberFormat("es-CO");

const PRODUCTO_COLS: ColumnDef<ProductoDto>[] = [
  { key: "productoIdDropi", label: "ID Dropi",          type: "text",   pinned: true, minWidth: 100 },
  { key: "sku",             label: "SKU",               type: "text" },
  { key: "nombre",          label: "Producto",          type: "text",   minWidth: 220 },
  { key: "qtyTotal",        label: "Unidades vendidas", type: "number", sortable: true },
  { key: "ordenesCount",    label: "Órdenes",           type: "number", sortable: true },
];

const VARIACION_COLS: ColumnDef<ProductoVariacionDto>[] = [
  { key: "variacionIdDropi", label: "ID Variación", type: "text" },
  { key: "nombreVariacion",  label: "Nombre",       type: "text", minWidth: 200 },
];

export function ProductosPage() {
  const [rows, setRows]           = useState<ProductoDto[]>([]);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage]           = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // Modal de variaciones
  const [selectedProducto, setSelectedProducto] = useState<ProductoDto | null>(null);
  const [variaciones, setVariaciones]           = useState<ProductoVariacionDto[]>([]);
  const [loadingVar, setLoadingVar]             = useState(false);

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

  const openVariaciones = async (producto: ProductoDto) => {
    setSelectedProducto(producto);
    setLoadingVar(true);
    try {
      setVariaciones(await dropiService.getVariaciones(producto.id));
    } finally { setLoadingVar(false); }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {NUM.format(total)} productos en catálogo
            {total === 0 && " — sube un archivo de tipo Órdenes por Producto"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load()} disabled={loading} className="h-8">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <DataTable<ProductoDto>
        columns={PRODUCTO_COLS}
        rows={rows}
        totalElements={total}
        totalPages={totalPages}
        page={page}
        size={50}
        isLoading={loading}
        emptyMessage="Sin productos. Sube un archivo de Órdenes por Producto."
        onPageChange={setPage}
        onSizeChange={() => {}}
        onRowClick={openVariaciones}
      />

      {/* Modal variaciones */}
      {selectedProducto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedProducto(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <Card className="relative z-10 w-full max-w-xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <CardHeader className="pb-3 flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">{selectedProducto.nombre ?? selectedProducto.sku}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">SKU: {selectedProducto.sku} · ID Dropi: {selectedProducto.productoIdDropi}</p>
              </div>
              <button onClick={() => setSelectedProducto(null)} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 pb-4">
              {loadingVar ? (
                <div className="flex justify-center py-8"><div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
              ) : variaciones.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin variaciones registradas.</p>
              ) : (
                <DataTable<ProductoVariacionDto>
                  columns={VARIACION_COLS}
                  rows={variaciones}
                  totalElements={variaciones.length}
                  totalPages={1}
                  page={0}
                  size={variaciones.length}
                  onPageChange={() => {}}
                  onSizeChange={() => {}}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
