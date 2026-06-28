// ─── OrdenDetallePage (modules/dropi/OrdenDetallePage.tsx) ───────────────────
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, AlertTriangle, Package, User, Truck, DollarSign, FileText } from "lucide-react";
import { dropiService } from "./dropi.service";
import type { OrdenDetalleDto } from "@/contracts/api.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const ESTATUS_STYLE: Record<string, string> = {
  ENTREGADO:  "bg-green-500/15 text-green-400  border-green-500/30",
  DEVOLUCION: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  CANCELADO:  "bg-red-500/15   text-red-400    border-red-500/30",
};

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
      <p className="text-sm mt-0.5">{String(value)}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3 pt-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 pb-4 sm:grid-cols-3 lg:grid-cols-4">
        {children}
      </CardContent>
    </Card>
  );
}

export function OrdenDetallePage() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const [orden, setOrden]     = useState<OrdenDetalleDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      setOrden(await dropiService.getOrden(Number(id)));
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.message ?? "No se pudo cargar la orden.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const estatusStyle = orden?.estatus
    ? (ESTATUS_STYLE[orden.estatus.toUpperCase()] ?? "bg-muted text-muted-foreground border-border")
    : "";

  return (
    <div className="space-y-4 animate-fade-in max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5 shrink-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold tracking-tight">
              Orden{" "}
              <span className="font-mono text-primary">#{orden?.dropiId ?? id}</span>
            </h1>
            {orden?.estatus && (
              <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider", estatusStyle)}>
                {orden.estatus}
              </span>
            )}
          </div>
          {orden && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {orden.fecha} · {orden.tienda ?? "Sin tienda"}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8 shrink-0">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-400 flex gap-2 items-center">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {loading && !orden && (
        <div className="flex justify-center py-16 text-muted-foreground gap-2">
          <RefreshCw className="h-5 w-5 animate-spin" /> Cargando…
        </div>
      )}

      {orden && (
        <>
          {/* Envío */}
          <Section title="Envío y logística" icon={Truck}>
            <Field label="Guía"           value={orden.numeroGuia} />
            <Field label="Transportadora" value={orden.transportadora} />
            <Field label="Tipo de envío"  value={orden.tipoEnvio} />
            <Field label="Departamento"   value={orden.departamentoDestino} />
            <Field label="Ciudad"         value={orden.ciudadDestino} />
            <Field label="Dirección"      value={orden.direccion} />
            <Field label="Código postal"  value={orden.codigoPostal} />
            <Field label="Fecha guía"     value={orden.fechaGuiaGenerada} />
          </Section>

          {/* Precios — Tienda */}
          <Section title="Precios de venta (perspectiva Tienda)" icon={DollarSign}>
            <Field label="Total orden"          value={orden.totalOrden != null ? COP.format(orden.totalOrden) : null} />
            <Field label="Ganancia"             value={orden.ganancia   != null ? COP.format(orden.ganancia)   : null} />
            <Field label="Precio flete"         value={orden.precioFlete != null ? COP.format(orden.precioFlete) : null} />
            <Field label="Dev. flete"           value={orden.costoDevolucionFlete != null ? COP.format(orden.costoDevolucionFlete) : null} />
            <Field label="Comisión"             value={orden.comision   != null ? COP.format(orden.comision)   : null} />
            {orden.numeroFactura &&  <Field label="Factura"  value={orden.numeroFactura} />}
            {orden.valorFacturado != null && <Field label="Valor facturado" value={COP.format(orden.valorFacturado)} />}
          </Section>

          {/* Cliente */}
          {orden.cliente && (
            <Section title="Cliente" icon={User}>
              <Field label="Nombre"           value={orden.cliente.nombre} />
              <Field label="Teléfono"         value={orden.cliente.telefono} />
              <Field label="Email"            value={orden.cliente.email} />
              <Field label="Identificación"   value={orden.cliente.nroIdentificacion
                ? `${orden.cliente.tipoIdentificacion ?? ""} ${orden.cliente.nroIdentificacion}`.trim()
                : null} />
            </Section>
          )}

          {/* Tienda */}
          <Section title="Tienda" icon={Package}>
            <Field label="Tienda"        value={orden.tienda} />
            <Field label="Tipo"          value={orden.tipoTienda} />
            <Field label="Vendedor"      value={orden.vendedor} />
            <Field label="ID orden ext." value={orden.idOrdenTienda} />
            <Field label="# Pedido ext." value={orden.numeroPedidoTienda} />
            <Field label="Tags"          value={orden.tags} />
          </Section>

          {/* Novedad */}
          {(orden.novedad || orden.solucion || orden.ultimoMovimiento) && (
            <Section title="Novedades y movimientos" icon={FileText}>
              <Field label="Novedad"              value={orden.novedad} />
              <Field label="¿Solucionada?"        value={orden.fueSolucionadaNovedad} />
              <Field label="Solución"             value={orden.solucion} />
              <Field label="Observación"          value={orden.observacion} />
              <Field label="Último movimiento"    value={orden.ultimoMovimiento} />
              <Field label="Concepto"             value={orden.conceptoUltimoMovimiento} />
              <Field label="Ubicación"            value={orden.ubicacionUltimoMovimiento} />
              <Field label="Fecha últ. mov."      value={orden.fechaUltimoMovimiento} />
            </Section>
          )}

          {/* Items de producto */}
          {orden.tieneItems && orden.items?.length > 0 && (
            <Card>
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-400" />
                  Productos — perspectiva Bodega/Proveedor
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="overflow-x-auto rounded border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/80 border-b border-border">
                      <tr>
                        {["SKU","Producto","Variación","Cantidad","P. Proveedor","P. Prov. × Cant.","% Comisión"].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {orden.items.map(item => (
                        <tr key={item.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-mono text-muted-foreground">{item.sku ?? "—"}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate" title={item.nombreProducto ?? ""}>{item.nombreProducto ?? "—"}</td>
                          <td className="px-3 py-2">{item.nombreVariacion ?? "—"}</td>
                          <td className="px-3 py-2 tabular-nums text-center font-medium">{item.cantidad ?? "—"}</td>
                          <td className="px-3 py-2 tabular-nums text-right">{item.precioProveedor != null ? COP.format(item.precioProveedor) : "—"}</td>
                          <td className="px-3 py-2 tabular-nums text-right text-emerald-400">{item.precioProveedorXCantidad != null ? COP.format(item.precioProveedorXCantidad) : "—"}</td>
                          <td className="px-3 py-2 tabular-nums text-right">{item.porcentajeComisionPlataforma != null ? `${item.porcentajeComisionPlataforma}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
