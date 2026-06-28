# Data Hub — Documentación de API

## Entorno

| Parámetro | Valor |
|---|---|
| **URL Base (local)** | `http://localhost:8080` |
| **DB Host** | `localhost:5432` |
| **Tenant semilla** | ID `1` — "Dropi Tools" |
| **Admin** | `admin` / `admin123` |
| **Almacenamiento** | `/app/files/{tenantId}/` (volumen Docker `files_data`) |

- **Deduplicación:** SHA-256 por archivo por tenant → `409` si ya existe.
- **Procesamiento asíncrono:** upload encola un `ImportJob PENDING`; el scheduler lo toma con `FOR UPDATE SKIP LOCKED`.

---

## Autenticación — JWT Stateless

Todas las peticiones (excepto login) requieren:
```
Authorization: Bearer <TOKEN>
```

### `POST /api/auth/login`
```json
// Body
{ "username": "admin", "password": "admin123" }

// 200 OK
{ "status": 200, "data": { "accessToken": "eyJ...", "expiresIn": 3600 } }
```

### `GET /api/auth/me`
```json
// 200 OK
{ "status": 200, "data": { "id": 1, "tenantId": 1, "username": "admin", "role": "ADMIN", "isActive": true } }
```

---

## Plantillas de importación soportadas

| `template` | Archivo | Tabla staging | Fase 2 |
|---|---|---|---|
| `DROPI_ORDER` | Reporte de Órdenes | `stg_dropi_order` | UPSERT en `ordenes` |
| `DOPI_ORDER_PRODUCT` | Reporte Órdenes × Producto | `stg_dropi_order_product` | UPSERT en `ordenes` + `orden_items` + `producto_variaciones` |

---

## Archivos y Jobs

### `POST /api/files/upload`
Multipart: `file` (`.xlsx`/`.xls`) + `template` (string).

```json
// 201 Created
{ "status": 201, "data": { "jobId": 1, "fileId": 1 } }
// 400 extensión inválida · 409 duplicado (mismo SHA-256)
```

### `GET /api/import-jobs`
`?status=PENDING|RUNNING|COMPLETED|ERROR&page=0&size=20`

### `GET /api/import-jobs/{id}`
Polling: campo `progress` 0–100.

---

## Staging — datos crudos

### `GET /api/staging/{jobId}`
`?page=0&size=50&sortBy=id&sortDir=asc`

### `GET /api/staging`
`?template=DROPI_ORDER&page=0&size=50&sortBy=id&sortDir=desc`

Respuesta:
```json
{
  "template": "DROPI_ORDER",
  "columns": [{ "key": "idDropi", "label": "ID Dropi", "type": "text" }],
  "rows": [{ "idDropi": "61934139", "estatus": "ENTREGADO" }],
  "totalElements": 92, "totalPages": 2, "page": 0, "size": 50
}
```
`501` si el template no existe.

---

## Dropi — datos normalizados

### Órdenes

#### `GET /api/dropi/ordenes`
```
?estatus=ENTREGADO
&ciudad=MEDELLIN
&tiendaId=1
&fechaDesde=2026-01-01    (ISO date)
&fechaHasta=2026-06-30
&page=0&size=50&sortBy=fecha&sortDir=desc
```

Campos devueltos por fila: `id, dropiId, fecha, estatus, nombreCliente, telefono, ciudadDestino, departamentoDestino, transportadora, numeroGuia, totalOrden, ganancia, precioFlete, costoProveedorTotal, tienda, vendedor, tieneItems, createdAt`

#### `GET /api/dropi/ordenes/{id}`
Detalle completo: campos de envío, precios (tienda), facturación, tienda, novedad, cliente, **items** (productos pedidos con variación y precio proveedor).

```json
{
  "dropiId": "61934139",
  "estatus": "ENTREGADO",
  "cliente": { "nombre": "Marlon Parada", "telefono": "3232518288" },
  "items": [
    {
      "sku": "nova19",
      "nombreProducto": "Cargador retractil para carro",
      "nombreVariacion": null,
      "variacionIdDropi": null,
      "cantidad": 1,
      "precioProveedor": 32000,
      "precioProveedorXCantidad": 32000,
      "porcentajeComisionPlataforma": 5
    }
  ]
}
```

---

### Clientes

#### `GET /api/dropi/clientes`
`?q=marlon&page=0&size=50` — búsqueda por nombre/teléfono/email.

---

### Productos

#### `GET /api/dropi/productos`
`?page=0&size=50` — catálogo con `qtyTotal` y `ordenesCount`.
Solo tiene datos si se subió `DOPI_ORDER_PRODUCT`.

#### `GET /api/dropi/productos/{id}/variaciones`
Lista de variaciones del producto: `[{ variacionIdDropi, nombreVariacion }]`

---

### Stats / Dashboard

#### `GET /api/dropi/stats`
```
?fechaDesde=2026-06-22    (ISO date, opcional)
&fechaHasta=2026-06-28    (ISO date, opcional)
```
Default: últimos 7 días si no se envían parámetros.

Calcula automáticamente el % de cambio vs. el período anterior de igual duración.

```json
{
  "totalOrdenes": 92,
  "ventaTotal": 8730800,
  "gananciaTotal": 3651636,
  "ordenesEntregadas": 47,
  "tasaEntrega": 51.1,
  "fleteTotal": 1792486,
  "comisionTotal": 347426,
  "margenNeto": 41.82,
  "pctVenta": 12.4,
  "pctGanancia": 8.1,
  "pctOrdenes": -3.2,
  "pctCostoProveedor": 10.2,
  "unidadesTotal": 939,
  "costoProveedorTotal": 30048000,
  "ordenesConItems": 61,
  "porEstatus": [
    { "estatus": "ENTREGADO", "count": 47, "montoTotal": 4463650 }
  ],
  "topCiudades": [
    { "ciudad": "BOGOTA", "count": 18, "montoTotal": 1706400 }
  ],
  "evolucionDiaria": [
    { "fecha": "2026-06-22", "count": 5, "gananciaTotal": 198450, "ventaTotal": 474500 }
  ],
  "topProductos": [
    { "nombre": "Cargador retractil para carro", "sku": "nova19", "qtyTotal": 939, "ordenesCount": 61 }
  ],
  "ordenesActivas": [
    { "id": 12, "dropiId": "61934139", "estatus": "EN CAMINO", "transportadora": "INTERRAPIDISIMO",
      "fecha": "2026-06-27", "totalOrden": 94900, "ciudadDestino": "CUCUTA", "diasActiva": 1 }
  ]
}
```

---

## Errores estándar

```json
{ "status": 409, "message": "Archivo duplicado.", "data": null, "timestamp": "..." }
```

| Código | Situación |
|---|---|
| `400` | Body/archivo inválido |
| `401` | Sin token o credenciales incorrectas |
| `403` | Recurso de otro tenant |
| `409` | Conflicto (archivo duplicado) |
| `501` | Template de staging no soportado |
| `500` | Error interno |

---

## Cómo añadir una nueva plantilla

1. `V{N}__add_stg_{nombre}.sql` — nueva tabla staging
2. `StgNombreEntity` + `StgNombreRepository`
3. `NombreProcessor implements ImportProcessor` — `supports("NUEVO_TEMPLATE")`
4. `NombreStagingReader implements StagingTableReader` — `getTemplate()="NUEVO_TEMPLATE"`
5. Añadir `{ id: "NUEVO_TEMPLATE", label: "...", description: "..." }` en `frontend/src/lib/templates.ts`

El scheduler, `StagingService` y el selector de upload lo descubren automáticamente.
