// ─── DashboardPage (modules/dropi/DashboardPage.tsx) ─────────────────────────
import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Area, AreaChart,
} from "recharts";
import {
  TrendingUp, Package,
  ShoppingCart, Truck, DollarSign, BarChart3, RefreshCw, AlertTriangle,
} from "lucide-react";
import { dropiService } from "./dropi.service";
import type { DropisStatsDto } from "@/contracts/api.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Paleta de colores para gráficas ──────────────────────────────────────────
const ESTATUS_COLORS: Record<string, string> = {
  ENTREGADO:  "#22c55e",
  DEVOLUCION: "#f97316",
  CANCELADO:  "#ef4444",
  PENDING:    "#eab308",
  NOVEDAD:    "#a855f7",
};
const CHART_COLORS = ["#6366f1", "#22c55e", "#f97316", "#06b6d4", "#a855f7",
                       "#eab308", "#ef4444", "#14b8a6", "#f43f5e", "#84cc16"];
const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat("es-CO");

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, accent = false }:
  { label: string; value: string; sub?: string; icon: React.ElementType; accent?: boolean }) {
  return (
    <Card className={cn(accent && "border-primary/30 bg-primary/5")}>
      <CardContent className="flex items-start gap-4 pt-5 pb-4">
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          accent ? "bg-primary/20" : "bg-muted"
        )}>
          <Icon className={cn("h-5 w-5", accent ? "text-primary" : "text-muted-foreground")} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn("text-2xl font-bold tabular-nums mt-0.5", accent && "text-primary")}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Tooltip personalizado ─────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, currency = false }:
  { active?: boolean; payload?: any[]; label?: string; currency?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-xl">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="tabular-nums">
          {p.name}: {currency ? COP.format(p.value) : NUM.format(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Nombre del mes ────────────────────────────────────────────────────────────
const MESES = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
               "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// ── Componente principal ──────────────────────────────────────────────────────
export function DashboardPage() {
  const [stats, setStats]       = useState<DropisStatsDto | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setStats(await dropiService.getStats());
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.message ?? "No se pudo cargar el resumen.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading && !stats) return (
    <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
      <RefreshCw className="h-5 w-5 animate-spin" />
      Cargando resumen…
    </div>
  );

  if (error) return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-400 flex gap-2 items-center">
      <AlertTriangle className="h-4 w-4 shrink-0" />{error}
    </div>
  );

  if (!stats) return null;

  const hasItems    = stats.ordenesConItems > 0;
  const tasa        = Number(stats.tasaEntrega).toFixed(1);

  // Datos para la evolución: unir mes-año en una etiqueta
  const evolucionData = stats.evolucion.map(m => ({
    mes:      `${MESES[m.mes]} ${String(m.anio).slice(2)}`,
    ordenes:  m.count,
    ganancia: m.gananciaTotal,
  }));

  // Datos para estatus donut
  const estatusData = stats.porEstatus.map(e => ({
    name:  e.estatus,
    value: e.count,
    monto: e.montoTotal,
  }));

  // Top ciudades (horizontal bar)
  const ciudadesData = [...stats.topCiudades]
    .slice(0, 10)
    .map(c => ({ ciudad: c.ciudad || "Sin ciudad", ordenes: c.count, monto: c.montoTotal }));

  // Top productos
  const productosData = stats.topProductos.slice(0, 8).map(p => ({
    nombre: p.nombre ? (p.nombre.length > 22 ? p.nombre.slice(0, 22) + "…" : p.nombre) : p.sku || "–",
    qty: p.qtyTotal,
    ordenes: p.ordenesCount,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Resumen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {NUM.format(stats.totalOrdenes)} órdenes registradas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* ── Sección TIENDA ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Vista Tienda — precios de venta
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Total órdenes"    value={NUM.format(stats.totalOrdenes)}     icon={ShoppingCart} />
          <KpiCard label="Venta total"      value={COP.format(stats.ventaTotal)}       icon={DollarSign} />
          <KpiCard label="Ganancia total"   value={COP.format(stats.gananciaTotal)}    icon={TrendingUp} accent />
          <KpiCard label="Tasa de entrega"  value={`${tasa}%`}
                   sub={`${NUM.format(stats.ordenesEntregadas)} entregadas`}           icon={Truck} />
        </div>
      </section>

      {/* ── Sección BODEGA ────────────────────────────────────────────────── */}
      {hasItems && (
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Vista Bodega / Proveedor — precio de costo
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KpiCard label="Unidades despachadas" value={NUM.format(stats.unidadesTotal)}       icon={Package} />
            <KpiCard label="Costo proveedor"      value={COP.format(stats.costoProveedorTotal)} icon={DollarSign} />
            <KpiCard label="Órdenes con items"    value={NUM.format(stats.ordenesConItems)}     icon={BarChart3} />
          </div>
        </section>
      )}

      {/* ── Gráficas fila 1: Estatus + Ciudades ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Donut — por estatus */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Órdenes por estado</CardTitle>
          </CardHeader>
          <CardContent>
            {estatusData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={estatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    dataKey="value" nameKey="name" paddingAngle={2}>
                    {estatusData.map((e, i) => (
                      <Cell key={e.name} fill={ESTATUS_COLORS[e.name] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconSize={10} iconType="circle"
                    formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bar horizontal — top ciudades */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top 10 ciudades</CardTitle>
          </CardHeader>
          <CardContent>
            {ciudadesData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ciudadesData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="ciudad" width={80}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="ordenes" name="Órdenes" fill="#6366f1" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Gráfica fila 2: Evolución mensual ───────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Evolución mensual — órdenes y ganancia</CardTitle>
        </CardHeader>
        <CardContent>
          {evolucionData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Sin datos de evolución</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={evolucionData} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="gradOrdenes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradGanancia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconSize={10} iconType="circle"
                  formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                <Area yAxisId="left"  type="monotone" dataKey="ordenes"  name="Órdenes"
                  stroke="#6366f1" fill="url(#gradOrdenes)"  strokeWidth={2} dot={{ r: 3 }} />
                <Area yAxisId="right" type="monotone" dataKey="ganancia" name="Ganancia"
                  stroke="#22c55e" fill="url(#gradGanancia)" strokeWidth={2} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Gráfica fila 3: Top productos (solo si hay items) ───────────── */}
      {hasItems && productosData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top productos por unidades vendidas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={productosData} margin={{ top: 4, right: 16, bottom: 40, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="nombre" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="qty" name="Unidades" fill="#06b6d4" radius={[3, 3, 0, 0]}>
                  {productosData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
