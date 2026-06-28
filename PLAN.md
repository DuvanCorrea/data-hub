# Plan de Trabajo — Data Hub (Dropi Tools)

## Estado Actual

| Módulo | Estado |
|---|---|
| Base de datos, Docker, Flyway | ✅ |
| Autenticación JWT | ✅ |
| Subida de archivos + ImportJob queue | ✅ |
| Worker: Excel reader (POI) + scheduler + staging | ✅ |
| Template DROPI_ORDER → stg_dropi_order | ✅ |
| Template DOPI_ORDER_PRODUCT → stg_dropi_order_product | ✅ |
| Visor de staging dinámico (frontend + backend) | ✅ |
| DynamicDataTable (filtros, export, portales) | ✅ |

---

## Etapa 3 — Normalización de datos (Backend) ⏳

### Modelo normalizado (schema destino)

```
tiendas(id, tenant_id, nombre, tipo, created_at, updated_at)
  UNIQUE(tenant_id, nombre)

vendedores(id, tenant_id, tienda_id→tiendas, nombre, created_at)
  UNIQUE(tenant_id, nombre)

clientes(id, tenant_id, nombre, telefono, email,
         tipo_identificacion, nro_identificacion, created_at, updated_at)
  UNIQUE INDEX (tenant_id, telefono) WHERE telefono IS NOT NULL

ordenes(id, tenant_id, dropi_id,
        cliente_id→clientes, tienda_id→tiendas, vendedor_id→vendedores,
        ── orden ──
        fecha, hora, fecha_reporte, estatus,
        ── envío ──
        numero_guia, tipo_envio, transportadora,
        departamento_destino, ciudad_destino, direccion, codigo_postal,
        ── precio venta (perspectiva TIENDA) ──
        total_orden, ganancia, precio_flete,
        costo_devolucion_flete, comision,
        ── facturación (solo DROPI_ORDER) ──
        numero_factura, valor_facturado, orden_dropshipper,
        usuario_generacion_guia, categorias,
        ── refs tienda / logística ──
        id_orden_tienda, numero_pedido_tienda, tags, fecha_guia_generada,
        ── novedad / movimiento ──
        novedad, fue_solucionada_novedad, fecha_novedad, solucion,
        fecha_solucion, observacion, ultimo_movimiento,
        concepto_ultimo_movimiento, ubicacion_ultimo_movimiento,
        fecha_ultimo_movimiento,
        ── indemnizaciones ──
        contador_indemnizaciones, concepto_ultima_indenmizacion,
        ── meta ──
        tiene_items BOOLEAN DEFAULT FALSE,
        created_at, updated_at)
  UNIQUE(tenant_id, dropi_id)
  DROP TABLE pedidos (reemplazada por ordenes)

productos(id, tenant_id, producto_id_dropi, sku, nombre, created_at, updated_at)
  UNIQUE(tenant_id, producto_id_dropi)

orden_items(id, orden_id→ordenes, tenant_id, producto_id→productos,
            producto_id_dropi, sku, variacion_id_dropi,
            nombre_producto, nombre_variacion, cantidad,
            ── precio proveedor (perspectiva BODEGA) ──
            precio_proveedor, precio_proveedor_x_cantidad,
            porcentaje_comision_plataforma,
            created_at)
  UNIQUE INDEX (orden_id, producto_id_dropi, COALESCE(variacion_id_dropi,''))
```

### Lógica de processStaging

**DROPI_ORDER** (1 fila = 1 orden, sin desglose de productos):
1. UPSERT `tiendas` ON CONFLICT(tenant_id, nombre)
2. UPSERT `vendedores` ON CONFLICT(tenant_id, nombre) → vincula a tienda
3. UPSERT `clientes` ON CONFLICT(tenant_id, telefono)
4. UPSERT `ordenes` ON CONFLICT(tenant_id, dropi_id) → no toca tiene_items
5. Marcar stg row como PROCESSED

**DOPI_ORDER_PRODUCT** (N filas = misma orden × N productos):
1. UPSERT `tiendas`
2. UPSERT `vendedores`
3. UPSERT `clientes`
4. UPSERT `ordenes` SET tiene_items = TRUE
5. UPSERT `productos` ON CONFLICT(tenant_id, producto_id_dropi)
6. UPSERT `orden_items` ON CONFLICT(orden_id, producto_id_dropi, variacion)
7. Marcar stg row como PROCESSED

### Nuevos endpoints REST `/api/dropi/*`

```
GET /api/dropi/ordenes              paginado, filtros: estatus, ciudad, fecha, tienda
GET /api/dropi/ordenes/{id}         detalle + cliente + items
GET /api/dropi/clientes             paginado + search por nombre/teléfono
GET /api/dropi/productos            paginado + qty_total + ordenes_count
GET /api/dropi/stats                KPIs: total_ordenes, ganancia_total, entregadas, tasa
GET /api/dropi/stats/por-estatus    [{estatus, count, monto_total}]
GET /api/dropi/stats/por-ciudad     top 15 [{ciudad, count, monto_total}]
GET /api/dropi/stats/evolucion      [{anio, mes, count, ganancia}]
GET /api/dropi/stats/top-productos  top 10 [{nombre, sku, qty_total, ordenes_count}]
```

### Archivos backend (Etapa 3)

| Nuevo | Tipo |
|---|---|
| `V3__normalize_dropi.sql` | Flyway migration |
| `TiendaEntity`, `VendedorEntity`, `ClienteEntity`, `OrdenEntity`, `ProductoEntity`, `OrdenItemEntity` | JPA entities |
| `TiendaRepository`, `VendedorRepository`, `ClienteRepository`, `OrdenRepository`, `ProductoRepository`, `OrdenItemRepository` | Spring Data |
| `DropisOrdenController`, `DropisClienteController`, `DropisProductoController`, `DropisStatsController` | REST |
| `OrdenListDto`, `OrdenDetalleDto`, `OrdenItemDto`, `ClienteDto`, `ProductoDto`, `DropisStatsDto` | DTOs |

| Modificado | Cambio |
|---|---|
| `DropiOrderProcessor` | processStaging → upsert tiendas+vendedores+clientes+ordenes |
| `DropiOrderProductProcessor` | processStaging → upsert todo + productos + orden_items |

---

## Etapa 4 — Dashboard y vistas (Frontend) ⏳

### Nueva dependencia
- `recharts` — gráficas interactivas (compatible con React 19 + TypeScript)

### Rutas nuevas

```
/dropi                → DashboardPage (Resumen)
/dropi/ordenes        → OrdenesPage
/dropi/ordenes/:id    → OrdenDetallePage
/dropi/clientes       → ClientesPage
/dropi/productos      → ProductosPage
```

### Sidebar — sección DROPI ampliada

```
▼ DROPI
  📊 Resumen
  📦 Órdenes
  👤 Clientes
  🏷  Productos
```

### DashboardPage — KPIs + gráficas

**Vista Tienda (precio de venta):**
- Total órdenes | Ganancia total | Órdenes entregadas | Tasa de entrega

**Vista Bodega/Proveedor (precio de proveedor):**
- Unidades despachadas | Costo proveedor total | Productos únicos movidos
- *(solo si hay datos de orden_items)*

**Gráficas:**
| Gráfica | Tipo | Fuente |
|---|---|---|
| Órdenes por estatus | Donut | `/stats/por-estatus` |
| Top 15 ciudades | Horizontal bar | `/stats/por-ciudad` |
| Evolución mensual (órdenes + ganancia) | Dual-axis line | `/stats/evolucion` |
| Top 10 productos por cantidad | Bar | `/stats/top-productos` |

### OrdenesPage
- Tabla: ID Dropi, Fecha, Cliente, Ciudad, Estatus, Total, Ganancia, Tienda
- Filtros: estatus (multi), ciudad, rango fecha, tienda
- Click → OrdenDetallePage: acordeones (info orden · cliente · productos)

### ClientesPage
- Tabla: Nombre, Teléfono, Email, Ciudad, # Órdenes
- Búsqueda en tiempo real

### ProductosPage
- Tabla: SKU, Nombre, Variaciones, Unidades vendidas, # Órdenes
- Solo tiene datos si se cargó DOPI_ORDER_PRODUCT

### Archivos frontend (Etapa 4)

| Nuevo |
|---|
| `src/modules/dropi/dropi.service.ts` |
| `src/modules/dropi/DashboardPage.tsx` |
| `src/modules/dropi/OrdenesPage.tsx` |
| `src/modules/dropi/OrdenDetallePage.tsx` |
| `src/modules/dropi/ClientesPage.tsx` |
| `src/modules/dropi/ProductosPage.tsx` |
| `src/modules/dropi/components/KpiCard.tsx` |
| `src/modules/dropi/components/EstatusChart.tsx` |
| `src/modules/dropi/components/CiudadesChart.tsx` |
| `src/modules/dropi/components/EvolucionChart.tsx` |
| `src/modules/dropi/components/TopProductosChart.tsx` |

| Modificado | Cambio |
|---|---|
| `App.tsx` | Nuevas rutas /dropi/* |
| `AppLayout.tsx` | Nueva sección DROPI en sidebar |
| `contracts/api.types.ts` | Nuevos tipos Orden, Cliente, Producto, Stats |

---

## API Keys (pendiente sprint futuro)
- Generación, revocación y hasheo SHA-256
- Filtro `ApiKeyAuthFilter`
- Endpoints públicos `/api/v1/*` con rate limiting
