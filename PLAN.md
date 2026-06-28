# Plan de Trabajo — Data Hub (Dropi Tools)

## Estado actual — todo completado hasta Etapa 4

| Módulo / Etapa | Estado |
|---|---|
| Base de datos, Docker, Flyway | ✅ |
| Autenticación JWT stateless | ✅ |
| Subida de archivos + ImportJob queue | ✅ |
| Worker: Excel reader (POI) + scheduler + staging | ✅ |
| Template `DROPI_ORDER` → `stg_dropi_order` | ✅ |
| Template `DOPI_ORDER_PRODUCT` → `stg_dropi_order_product` | ✅ |
| Visor de staging dinámico (frontend + backend) | ✅ |
| `DynamicDataTable` (filtros portal, export, multi-select) | ✅ |
| **Etapa 3** — Normalización de datos (backend) | ✅ |
| **Etapa 4** — Dashboard y vistas Dropi (frontend) | ✅ |

---

## Schema de base de datos (Flyway V1–V4)

| Migration | Contenido |
|---|---|
| `V1__init.sql` | tenants, users, files, import_jobs, stg_dropi_order, pedidos (legacy), api_keys |
| `V2__add_stg_dropi_order_product.sql` | stg_dropi_order_product |
| `V3__normalize_dropi.sql` | DROP pedidos · CREATE tiendas, vendedores, clientes, ordenes, productos, orden_items |
| `V4__add_producto_variaciones.sql` | producto_variaciones (catálogo de variantes por producto) |

### Tablas normalizadas (V3)

```
tiendas          → canal de venta (Shopify, WooCommerce, etc.) + vendedor
vendedores       → vendedor ligado a tienda
clientes         → deduplicado por (tenant_id, telefono)
ordenes          → 1 fila por dropi_id; perspectiva TIENDA (total_orden, ganancia)
productos        → catálogo; solo de DOPI_ORDER_PRODUCT
orden_items      → 1 fila por (orden × producto); perspectiva BODEGA (precio_proveedor)
producto_variaciones → variantes del producto (SKU, nombre variación)
```

---

## Etapa 3 — Normalización backend ✅

### Procesadores actualizados

| Template | Fase 2 (processStaging) |
|---|---|
| `DROPI_ORDER` | UPSERT tiendas → vendedores → clientes → ordenes |
| `DOPI_ORDER_PRODUCT` | UPSERT tiendas → vendedores → clientes → ordenes (tiene_items=true) → productos → orden_items → producto_variaciones |

### Servicio compartido
`DropisNormalizationService` — upsert de todas las entidades normalizadas.
`DropisQueryService` — queries de lectura: batch-fetch sin N+1, stats con fechas.

### Endpoints REST `/api/dropi/*`

```
GET /api/dropi/ordenes                      filtros: estatus, ciudad, fechaDesde/Hasta, tiendaId
GET /api/dropi/ordenes/{id}                 detalle + cliente + items (con variaciones)
GET /api/dropi/clientes                     paginado + search
GET /api/dropi/productos                    paginado + qty_total
GET /api/dropi/productos/{id}/variaciones   lista de variaciones del producto
GET /api/dropi/stats                        KPIs + distribuciones con filtro de fechas
                                            ?fechaDesde=YYYY-MM-DD&fechaHasta=YYYY-MM-DD
                                            Default: últimos 7 días
```

### DropisStatsDto — campos

**Perspectiva Tienda:** totalOrdenes, ventaTotal, gananciaTotal, ordenesEntregadas, tasaEntrega, fleteTotal, comisionTotal, margenNeto

**Tendencia vs período anterior:** pctVenta, pctGanancia, pctOrdenes, pctCostoProveedor

**Perspectiva Bodega:** unidadesTotal, costoProveedorTotal, ordenesConItems

**Distribuciones:** porEstatus, topCiudades (top 15), evolucionDiaria, topProductos (top 10), ordenesActivas (live ops)

---

## Etapa 4 — Dashboard y vistas frontend ✅

### Dependencias añadidas
- `recharts` — gráficas interactivas
- `@fortawesome/react-fontawesome` + `free-solid-svg-icons` — iconos

### Rutas y páginas

| Ruta | Página |
|---|---|
| `/dropi` | `DashboardPage` — resumen con KPIs, gráficas y live ops |
| `/dropi/ordenes` | `OrdenesPage` — tabla con `DataTable<OrdenListDto>` |
| `/dropi/ordenes/:id` | `OrdenDetallePage` — secciones acordeón + tabla de items |
| `/dropi/clientes` | `ClientesPage` — tabla + búsqueda server-side |
| `/dropi/productos` | `ProductosPage` — tabla + modal de variaciones |

### DashboardPage — layout del mockup

```
[DateRangePicker + accesos rápidos: Hoy / 7d / 1m / 1a]

[KPI: Ventas]  [KPI: Ganancia★]  [KPI: Costo prov.]  [KPI: Margen%]
                                  Cada uno con % tendencia vs período previo

[────── Gráfica AreaChart (Venta/Ganancia/COGS diario) ──── │ Status Panorama 2×3]
                                                             │ Entregados · En Reparto
                                                             │ Novedades  · Devoluciones
                                                             │ Cancelados · En Bodega

[Live Operations: tabla de órdenes activas (no entregadas/canceladas)
 días en amarillo ≥3, rojo ≥7]

[Top ciudades donut]  [Top productos barras horizontales]
```

### DataTable genérico (`src/components/data-table/DataTable.tsx`)

Componente universal reutilizable en todos los módulos:
- Tipado genérico `T extends object` con `ColumnDef<T>` + `render()` por columna
- Filtros en columna: texto / status multi-select (faceted) / date rango
- Visibilidad de columnas, selección con checkboxes
- Exportar CSV: selección / página / todo (con progress)
- Todos los dropdowns vía `createPortal` (sin clipping overflow)
- `onRowClick` tipado

### DateRangePicker (`src/modules/dropi/components/DateRangePicker.tsx`)
- Accesos rápidos: Hoy · 7 días · 1 mes · 1 año
- Preset activo resaltado
- Popup personalizado vía `createPortal`

---

## Skill de desarrollo (`~/.config/opencode/skills/senior-dev/`)

Skill global de OpenCode que fuerza comportamiento de desarrollador senior:
- Sin frases de relleno ni pre-ambles
- Código production-quality, patrones de arquitectura limpia
- Eficiencia de tokens

---

## Pendiente (sprints futuros)

| Item | Detalle |
|---|---|
| **API Keys** | Generación, revocación SHA-256, filtro `ApiKeyAuthFilter`, endpoints `/api/v1/*` con rate limiting |
| **Tabla de pedidos normalizada** (procesamiento Fase 2 DROPI_ORDER) | La Fase 2 actual solo normaliza hacia `ordenes`. Falta definir si se necesita una tabla final `pedidos` separada o si `ordenes` es suficiente |
| **Notificaciones** | Badge en el header para jobs completados / errores |
| **Exportación a Excel** | Además de CSV, exportar `.xlsx` desde la tabla |
| **Code splitting** | El bundle supera 500kB; aplicar lazy loading por ruta |
