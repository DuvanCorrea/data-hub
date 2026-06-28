// ─── DashboardPage (modules/dropi/DashboardPage.tsx) ─────────────────────────
// Layout basado en el mockup: KPIs + gráfica financiera + status panorama + live ops
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMoneyBillWave, faChartLine, faBoxes, faPercent,
  faCircleCheck, faTruck, faTriangleExclamation,
  faRotateLeft, faBan, faWarehouse,
  faArrowTrendUp, faArrowTrendDown, faMinus,
  faArrowRight, faRotate,
} from "@fortawesome/free-solid-svg-icons";
import { dropiService } from "./dropi.service";
import type { DropisStatsDto, OrdenActivaItem } from "@/contracts/api.types";
import { DateRangePicker } from "./components/DateRangePicker";
import type { DateRange } from "./components/DateRangePicker";
import { StatusBadge } from "@/components/data-table/DataTable";
import { cn } from "@/lib/utils";

// ── Formatters ────────────────────────────────────────────────────────────────
const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat("es-CO");
const SHORT = new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 2 });

function shortCOP(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${SHORT.format(n)}`;
  if (Math.abs(n) >= 1_000)     return COP.format(n);
  return COP.format(n);
}

function fmtDate(iso: string) {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function defaultRange(): DateRange {
  const today = new Date();
  const desde = new Date(today); desde.setDate(today.getDate() - 6);
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { desde: toIso(desde), hasta: toIso(today) };
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon, pct, accent = false,
}: {
  label: string; value: string; sub?: string;
  icon: any; pct?: number; accent?: boolean;
}) {
  const up   = pct != null && pct > 0;
  const down = pct != null && pct < 0;
  return (
    <div className={cn(
      "rounded-xl border p-5 flex flex-col gap-3 transition-colors",
      accent ? "border-primary/30 bg-primary/5" : "border-border bg-card"
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className={cn("text-3xl font-bold tabular-nums mt-1", accent && "text-primary")}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          accent ? "bg-primary/20" : "bg-muted"
        )}>
          <FontAwesomeIcon icon={icon} className={cn("h-4 w-4", accent ? "text-primary" : "text-muted-foreground")} />
        </div>
      </div>
      {pct != null && (
        <div className={cn(
          "inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 self-start",
          up   ? "bg-green-500/15 text-green-400" :
          down ? "bg-red-500/15   text-red-400"   :
                 "bg-muted       text-muted-foreground"
        )}>
          <FontAwesomeIcon
            icon={up ? faArrowTrendUp : down ? faArrowTrendDown : faMinus}
            className="h-3 w-3"
          />
          {up ? "+" : ""}{Number(pct).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

// ── Status panorama tile ──────────────────────────────────────────────────────
function StatusTile({ label, count, icon, color }: {
  label: string; count: number; icon: any; color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <FontAwesomeIcon icon={icon} className={cn("h-3.5 w-3.5", color)} />
      </div>
      <p className={cn("text-3xl font-bold tabular-nums", color)}>{NUM.format(count)}</p>
    </div>
  );
}

// ── Tooltip para la gráfica ───────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-xl space-y-1">
      <p className="font-medium text-muted-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="tabular-nums">
          {p.name}: {shortCOP(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function DashboardPage() {
  const navigate = useNavigate();
  const [range, setRange]   = useState<DateRange>(defaultRange());
  const [stats, setStats]   = useState<DropisStatsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await dropiService.getStats(range.desde, range.hasta));
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.message ?? "No se pudo cargar el resumen.");
    } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  // Construir mapa de conteo por estatus para el panorama
  const estatusMap = new Map(stats?.porEstatus.map(e => [e.estatus?.toUpperCase(), e.count]) ?? []);
  const getCount = (...keys: string[]) => keys.reduce((s, k) => s + (estatusMap.get(k) ?? 0), 0);

  // Datos para la gráfica (muestra hasta 60 puntos, sino agrupa)
  const chartData = stats?.evolucionDiaria.map(d => ({
    fecha: fmtDate(d.fecha),
    Venta: d.ventaTotal,
    Ganancia: d.gananciaTotal,
    Costo: d.ventaTotal - d.gananciaTotal,
  })) ?? [];

  const hasItems = (stats?.ordenesConItems ?? 0) > 0;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header con DateRangePicker ─────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Resumen</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {NUM.format(stats?.totalOrdenes ?? 0)} órdenes en el período
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker value={range} onChange={r => { setRange(r); }} />
          <button
            onClick={load} disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
            title="Actualizar"
          >
            <FontAwesomeIcon icon={faRotate} className={cn("h-3.5 w-3.5 text-muted-foreground", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-400 flex gap-2">
          <FontAwesomeIcon icon={faTriangleExclamation} className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total Ventas"
          value={shortCOP(stats?.ventaTotal ?? 0)}
          icon={faMoneyBillWave}
          pct={stats?.pctVenta}
        />
        <KpiCard
          label="Ganancia Total"
          value={shortCOP(stats?.gananciaTotal ?? 0)}
          icon={faChartLine}
          pct={stats?.pctGanancia}
          accent
        />
        <KpiCard
          label="Costo Proveedores"
          value={shortCOP(stats?.costoProveedorTotal ?? 0)}
          sub={hasItems ? `${NUM.format(stats?.unidadesTotal ?? 0)} unidades` : undefined}
          icon={faBoxes}
          pct={stats?.pctCostoProveedor}
        />
        <KpiCard
          label="Margen Neto"
          value={`${Number(stats?.margenNeto ?? 0).toFixed(2)}%`}
          sub={`Tasa entrega: ${Number(stats?.tasaEntrega ?? 0).toFixed(1)}%`}
          icon={faPercent}
          pct={stats?.pctOrdenes}
        />
      </div>

      {/* ── Gráfica financiera + Status panorama ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Gráfica — ocupa 2/3 */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold">Rendimiento Financiero</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-violet-400 rounded" />Venta</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-emerald-400 rounded" />Ganancia</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-slate-400 rounded" />COGS</span>
            </div>
          </div>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">Sin datos en el período</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gVenta"    x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gGanancia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCosto"    x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  interval={Math.max(0, Math.floor(chartData.length / 8) - 1)} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={v => `$${SHORT.format(v)}`} width={55} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="Venta"    stroke="#7c3aed" fill="url(#gVenta)"    strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="Ganancia" stroke="#10b981" fill="url(#gGanancia)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="Costo"    stroke="#94a3b8" fill="url(#gCosto)"    strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status Panorama — 1/3 */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-sm font-semibold">Panorama de Estados</p>
          <div className="grid grid-cols-2 gap-2">
            <StatusTile label="Entregados"  count={getCount("ENTREGADO")}
              icon={faCircleCheck} color="text-green-400" />
            <StatusTile label="En Reparto"  count={getCount("EN CAMINO","EN CAMINO A DESTINO","INTENTO DE ENTREGA")}
              icon={faTruck} color="text-blue-400" />
            <StatusTile label="Novedades"   count={getCount("NOVEDAD","CON NOVEDAD")}
              icon={faTriangleExclamation} color="text-yellow-400" />
            <StatusTile label="Devoluciones" count={getCount("DEVOLUCION","DEVOLUCIÓN","EN DEVOLUCION")}
              icon={faRotateLeft} color="text-red-400" />
            <StatusTile label="Cancelados"  count={getCount("CANCELADO","CANCELADO CLIENTE")}
              icon={faBan} color="text-red-400" />
            <StatusTile label="En Bodega"   count={getCount("RECLAME EN OFICINA","EN BODEGA")}
              icon={faWarehouse} color="text-slate-400" />
          </div>
        </div>
      </div>

      {/* ── Live Operations ───────────────────────────────────────────────── */}
      {(stats?.ordenesActivas?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <p className="text-sm font-semibold">Operaciones Activas</p>
            <button
              onClick={() => navigate("/dropi/ordenes")}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              Ver todas
              <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {["ID ORDEN","ESTADO","TRANSPORTADORA","DÍAS ACTIVA","CIUDAD","VALOR"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {stats!.ordenesActivas.map((o: OrdenActivaItem) => (
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/dropi/ordenes/${o.id}`)}
                    className="hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-primary">#{o.dropiId}</td>
                    <td className="px-4 py-3"><StatusBadge value={o.estatus} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{o.transportadora ?? "—"}</td>
                    <td className="px-4 py-3">
                      {o.diasActiva != null ? (
                        <span className={cn(
                          "font-medium tabular-nums",
                          o.diasActiva >= 7 ? "text-red-400" :
                          o.diasActiva >= 3 ? "text-yellow-400" : "text-foreground"
                        )}>
                          {o.diasActiva === 0 ? "Hoy" : `${o.diasActiva} día${o.diasActiva !== 1 ? "s" : ""}`}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{o.ciudadDestino ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-right font-medium">
                      {o.totalOrden != null ? COP.format(o.totalOrden) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Top ciudades + Top productos (si hay) ────────────────────────── */}
      {stats && (stats.topCiudades.length > 0 || stats.topProductos.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Top ciudades — donut */}
          {stats.topCiudades.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-semibold mb-3">Top ciudades</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats.topCiudades.slice(0, 8)}
                    cx="35%" cy="50%"
                    innerRadius={50} outerRadius={75}
                    dataKey="count" nameKey="ciudad" paddingAngle={2}
                  >
                    {stats.topCiudades.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => NUM.format(Number(v))} />
                  <Legend
                    layout="vertical" align="right" verticalAlign="middle"
                    iconSize={8} iconType="circle"
                    formatter={(v) => <span className="text-[11px] text-muted-foreground">{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top productos */}
          {hasItems && stats.topProductos.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-semibold mb-3">Top productos</p>
              <div className="space-y-2">
                {stats.topProductos.slice(0, 6).map((p, i) => {
                  const maxQty = stats.topProductos[0].qtyTotal;
                  const pct = maxQty > 0 ? (p.qtyTotal / maxQty) * 100 : 0;
                  return (
                    <div key={i} className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate max-w-[200px] text-muted-foreground" title={p.nombre}>{p.nombre || p.sku}</span>
                        <span className="tabular-nums font-medium ml-2">{NUM.format(p.qtyTotal)} uds</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-violet-500/70 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const COLORS = ["#6366f1","#22c55e","#f97316","#06b6d4","#a855f7","#eab308","#ef4444","#14b8a6"];
