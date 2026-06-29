# Módulo de Integración ERPNext — Instrucciones de Desarrollo

> **Versión:** 2.0
> **Estado:** Listo para desarrollo
> **Alcance v1:** Sincronización de Clientes (fuente DROPI → ERPNext v16)

---

## 1. Visión General

Este módulo es un **servicio de sincronización unidireccional** hacia ERPNext. Vive como monolito desacoplado, preparado para migración futura a microservicio. No conoce ningún otro sistema del negocio: los sistemas externos le envían datos ya listos a través de su propia API REST y él se encarga de sincronizarlos con ERPNext.

### Flujo de alto nivel

```
Sistema Externo           Módulo ERP Sync              ERPNext
(DROPI, Shopify, ...)          │
        │                      │
        │  POST /api/records   │
        │─────────────────────▶│  guarda en erp_incoming_records
        │                      │
        │  (opcional)          │
        │  POST /sync/trigger  │  disparo manual inmediato
        │─────────────────────▶│
        │                      │
        │                 [Scheduler]  corre cada N minutos
        │                      │
        │                      │  lee pending records
        │                      │  construye payload ERPNext
        │                      │  GET → verifica si existe
        │                      │  POST o PUT según resultado
        │                      │──────────────────────────▶ ERPNext API
        │                      │◀────────────────────────── respuesta
        │                      │
        │                      │  actualiza estado en BD
        │                      │  guarda log del intento
        │                      │
        │  GET /sync/status    │
        │─────────────────────▶│  consulta estado por id o lista
        │◀─────────────────────│
```

### Principios de diseño

- **Totalmente desacoplado**: no conoce tablas de DROPI, Shopify ni ningún otro sistema. Solo conoce sus propias tablas.
- **API-first**: los sistemas externos interactúan solo por HTTP, nunca por base de datos directa.
- **Sin transformadores por fuente**: como los datos ya llegan en formato estándar del módulo, no se necesita lógica de transformación por fuente. La transformación al formato ERPNext es única por versión y entity_type.
- **Idempotente**: reenviar el mismo registro no genera duplicados.
- **Auditable**: cada intento queda registrado con payload, respuesta y duración.
- **Parametrizado**: frecuencia, reintentos y comportamiento vienen de tabla de parámetros.
- **Preparado para escalar**: sin estado en memoria, todo en base de datos, fácil de extraer como microservicio.

---

## 2. Arquitectura del Módulo

```
┌──────────────────────────────────────────────────────────────────┐
│                        MÓDULO ERP SYNC                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │                    API REST (Express)                   │     │
│  │                                                         │     │
│  │  POST /api/records          ← recibe datos del externo  │     │
│  │  GET  /api/records          ← lista registros           │     │
│  │  GET  /api/records/:id      ← detalle + historial       │     │
│  │  POST /api/records/manual   ← inserción manual (UI)     │     │
│  │                                                         │     │
│  │  POST /sync/trigger         ← disparo manual (uno/todos)│     │
│  │  GET  /sync/status          ← estado por id o lista     │     │
│  │  POST /sync/requeue/:id     ← reencolar bloqueado       │     │
│  │                                                         │     │
│  │  GET  /admin/sources        ← listar fuentes activas    │     │
│  │  PUT  /admin/sources/:id    ← activar/desactivar fuente │     │
│  │  GET  /admin/dashboard      ← sirve el HTML del panel   │     │
│  └─────────────────────────────────────────────────────────┘     │
│                          │                                       │
│              ┌───────────▼───────────┐                           │
│              │      Sync Engine      │                           │
│              │                       │                           │
│              │  1. Lee pending       │                           │
│              │  2. Transforma        │                           │
│              │     (por versión ERP) │                           │
│              │  3. GET en ERPNext    │                           │
│              │  4. POST o PUT        │                           │
│              │  5. Actualiza estado  │                           │
│              │  6. Escribe log       │                           │
│              └───────────┬───────────┘                           │
│                          │                                       │
│        ┌─────────────────┼─────────────────┐                    │
│        ▼                 ▼                 ▼                    │
│  ┌──────────┐   ┌──────────────┐   ┌────────────┐              │
│  │erp_sources│  │erp_incoming_ │   │ erp_sync_  │              │
│  │          │   │  records     │   │    log     │              │
│  └──────────┘   └──────────────┘   └────────────┘              │
│                                                                  │
│  ┌─────────────────┐    ┌──────────────────────┐                │
│  │   Scheduler     │    │   ERP Client (HTTP)  │                │
│  │  (node-cron)    │    │   → ERPNext REST API │                │
│  └─────────────────┘    └──────────────────────┘                │
│                                                                  │
│  ┌─────────────────────────────────┐                            │
│  │   Panel Admin (HTML estático)   │                            │
│  │   /admin/dashboard              │                            │
│  └─────────────────────────────────┘                            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Tablas del Módulo

El módulo tiene su propio esquema en base de datos, completamente aislado. Se recomienda prefijo `erpsync_` para todas las tablas.

### 3.1 `erpsync_sources` — Fuentes registradas

Controla qué fuentes están activas y qué versión de ERPNext usan.

```sql
CREATE TABLE erpsync_sources (
  id              SERIAL PRIMARY KEY,
  source_name     VARCHAR(50)  NOT NULL UNIQUE,  -- 'DROPI', 'SHOPIFY', 'MANUAL'
  description     TEXT         NULL,
  erp_version     VARCHAR(20)  NOT NULL,         -- 'v16', 'v15'
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Datos iniciales
INSERT INTO erpsync_sources (source_name, description, erp_version, is_active) VALUES
  ('DROPI',  'Integración con plataforma DROPI', 'v16', TRUE),
  ('MANUAL', 'Ingreso manual desde panel admin',  'v16', TRUE);
```

> La fuente controla si su sincronización automática está activa. Si `is_active = FALSE`, los registros de esa fuente se ignoran en el scheduler pero se pueden disparar manualmente.

---

### 3.2 `erpsync_incoming_records` — Registros recibidos

Es la tabla central. Aquí llegan todos los datos enviados por los sistemas externos. Funciona como cola de entrada y como fuente de verdad del estado de sincronización.

```sql
CREATE TABLE erpsync_incoming_records (
  id               SERIAL PRIMARY KEY,

  -- Identificación
  source_name      VARCHAR(50)   NOT NULL REFERENCES erpsync_sources(source_name),
  entity_type      VARCHAR(50)   NOT NULL,        -- 'customer', 'item', 'sales_order'
  external_id      VARCHAR(200)  NOT NULL,        -- ID del registro en el sistema de origen
  erp_doctype      VARCHAR(100)  NOT NULL,        -- 'Customer', 'Item', 'Sales Order'

  -- Datos recibidos (el payload ya listo para transformar a ERPNext)
  payload          JSONB         NOT NULL,        -- datos enviados por el sistema externo

  -- Estado de sincronización
  sync_status      VARCHAR(30)   NOT NULL DEFAULT 'pending',
  -- Valores: pending | processing | synced | error | blocked | skipped

  -- Resultado en ERPNext
  erp_record_id    VARCHAR(100)  NULL,            -- name en ERPNext (ej: CUST-0001)
  erp_method       VARCHAR(10)   NULL,            -- 'POST' o 'PUT' (qué se hizo)

  -- Control de reintentos
  attempts         INTEGER       NOT NULL DEFAULT 0,
  max_attempts     INTEGER       NOT NULL DEFAULT 3,
  next_attempt_at  TIMESTAMP     NULL,            -- cuándo se puede reintentar
  last_attempt_at  TIMESTAMP     NULL,

  -- Último error
  last_error_code  VARCHAR(50)   NULL,
  last_error_msg   TEXT          NULL,

  -- Metadatos
  triggered_by     VARCHAR(50)   NOT NULL DEFAULT 'scheduler',
  created_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP     NOT NULL DEFAULT NOW(),

  -- Un registro único por fuente + tipo + id externo
  UNIQUE (source_name, entity_type, external_id)
);

CREATE INDEX idx_incoming_sync_status    ON erpsync_incoming_records(sync_status);
CREATE INDEX idx_incoming_source         ON erpsync_incoming_records(source_name);
CREATE INDEX idx_incoming_entity_type    ON erpsync_incoming_records(entity_type);
CREATE INDEX idx_incoming_next_attempt   ON erpsync_incoming_records(next_attempt_at);
CREATE INDEX idx_incoming_erp_record     ON erpsync_incoming_records(erp_record_id);
```

**Ciclo de vida del `sync_status`:**

```
                   ┌─────────────────────────────────────────┐
                   │         Sistema externo envía datos      │
                   └───────────────────┬─────────────────────┘
                                       ▼
                                   [pending]
                                       │
                          Scheduler o trigger manual
                                       │
                                       ▼
                                 [processing]
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
                 [synced]                             [error]
              (éxito total)                   attempts < max_attempts
                                                         │
                                              ┌──────────┤
                                              │  espera  │
                                              │  delay   │
                                              └──────────┘
                                                         │
                                              attempts >= max_attempts
                                                         │
                                                         ▼
                                                    [blocked]
                                              (requiere acción manual)

              [skipped] → registro recibido idéntico a uno ya sincronizado
```

---

### 3.3 `erpsync_log` — Auditoría de cada intento

Cada vez que el engine intenta sincronizar un registro, queda una fila aquí.

```sql
CREATE TABLE erpsync_log (
  id               SERIAL PRIMARY KEY,
  record_id        INTEGER       NOT NULL REFERENCES erpsync_incoming_records(id),

  attempt_number   INTEGER       NOT NULL,
  triggered_by     VARCHAR(50)   NOT NULL,   -- 'scheduler' | 'manual' | 'api'
  started_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
  finished_at      TIMESTAMP     NULL,
  duration_ms      INTEGER       NULL,

  -- Qué se envió y qué respondió ERPNext
  erp_version      VARCHAR(20)   NOT NULL,
  erp_doctype      VARCHAR(100)  NOT NULL,
  http_method      VARCHAR(10)   NULL,       -- 'GET' | 'POST' | 'PUT'
  http_url         VARCHAR(500)  NULL,
  http_status      INTEGER       NULL,       -- 200, 201, 404, 409, 417, 500...
  request_payload  JSONB         NULL,       -- JSON enviado a ERPNext
  response_body    JSONB         NULL,       -- respuesta cruda de ERPNext

  -- Resultado
  result           VARCHAR(20)   NOT NULL,   -- 'success' | 'error' | 'skipped'
  error_code       VARCHAR(50)   NULL,
  error_message    TEXT          NULL,

  created_at       TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_log_record_id  ON erpsync_log(record_id);
CREATE INDEX idx_log_result     ON erpsync_log(result);
CREATE INDEX idx_log_started_at ON erpsync_log(started_at DESC);
```

---

## 4. Parámetros del Módulo

Se almacenan en la tabla de parámetros existente del sistema con prefijo `ERPSYNC_`.

| Clave                       | Valor por defecto | Descripción                                             |
| --------------------------- | ----------------- | -------------------------------------------------------- |
| `ERPSYNC_ENABLED`         | `true`          | Activa o pausa el scheduler completamente                |
| `ERPSYNC_CRON`            | `*/15 * * * *`  | Frecuencia de ejecución automática (cron expression)   |
| `ERPSYNC_MAX_ATTEMPTS`    | `3`             | Reintentos máximos antes de pasar a`blocked`          |
| `ERPSYNC_RETRY_DELAY_MIN` | `10`            | Minutos de espera entre reintentos                       |
| `ERPSYNC_BATCH_SIZE`      | `50`            | Registros procesados por ciclo del scheduler             |
| `ERPSYNC_ERP_BASE_URL`    | —                | URL base de ERPNext (ej:`http://192.168.1.74:9999`)    |
| `ERPSYNC_ERP_AUTH`        | —                | Header Authorization para ERPNext (`Basic xxx==`)      |
| `ERPSYNC_ERP_TIMEOUT_MS`  | `15000`         | Timeout en ms para llamadas HTTP a ERPNext               |
| `ERPSYNC_LOG_PAYLOAD`     | `true`          | Guarda el payload en el log (puede desactivarse en prod) |
| `ERPSYNC_CUSTOMER_GROUP`  | `Individual`    | Valor fijo de customer_group en ERPNext para clientes    |
| `ERPSYNC_TERRITORY`       | `Colombia`      | Valor fijo de territory en ERPNext para clientes         |

---

## 5. API REST del Módulo

### 5.1 Recepción de datos (para sistemas externos)

#### `POST /api/records`

Recibe uno o varios registros para encolar. Si el registro ya existe (`source_name + entity_type + external_id`), actualiza el payload y vuelve a poner en `pending` para resincronizar.

**Request:**

```json
{
  "source_name": "DROPI",
  "entity_type": "customer",
  "records": [
    {
      "external_id": "DRP-C-00123",
      "payload": {
        "customer_name": "María García",
        "email_id": "maria@correo.com",
        "mobile_no": "3001234567"
      }
    },
    {
      "external_id": "DRP-C-00124",
      "payload": {
        "customer_name": "Juan Pérez",
        "email_id": "juan@correo.com",
        "mobile_no": "3009876543"
      }
    }
  ]
}
```

**Response `200`:**

```json
{
  "received": 2,
  "enqueued": 1,
  "re_enqueued": 1,
  "records": [
    { "external_id": "DRP-C-00123", "record_id": 45, "status": "pending", "action": "enqueued" },
    { "external_id": "DRP-C-00124", "record_id": 12, "status": "pending", "action": "re_enqueued" }
  ]
}
```

**Response `400`** (source inactiva o inexistente):

```json
{
  "error": "SOURCE_INACTIVE",
  "message": "La fuente DROPI no está activa o no existe"
}
```

---

#### `GET /api/records`

Lista registros con filtros opcionales.

**Query params:** `source_name`, `entity_type`, `sync_status`, `from_date`, `to_date`, `page`, `limit`

**Response `200`:**

```json
{
  "total": 142,
  "page": 1,
  "limit": 20,
  "data": [
    {
      "id": 45,
      "source_name": "DROPI",
      "entity_type": "customer",
      "external_id": "DRP-C-00123",
      "sync_status": "synced",
      "erp_record_id": "CUST-0001",
      "attempts": 1,
      "created_at": "2026-06-29T10:00:00Z",
      "updated_at": "2026-06-29T10:02:13Z"
    }
  ]
}
```

---

#### `GET /api/records/:id`

Detalle de un registro con historial de intentos.

**Response `200`:**

```json
{
  "id": 45,
  "source_name": "DROPI",
  "entity_type": "customer",
  "external_id": "DRP-C-00123",
  "erp_doctype": "Customer",
  "payload": { "customer_name": "María García", "email_id": "maria@correo.com" },
  "sync_status": "synced",
  "erp_record_id": "CUST-0001",
  "erp_method": "POST",
  "attempts": 1,
  "created_at": "2026-06-29T10:00:00Z",
  "log": [
    {
      "id": 88,
      "attempt_number": 1,
      "triggered_by": "scheduler",
      "started_at": "2026-06-29T10:02:00Z",
      "duration_ms": 312,
      "http_method": "POST",
      "http_status": 200,
      "result": "success",
      "erp_record_id": "CUST-0001"
    }
  ]
}
```

---

#### `GET /sync/status`

Consulta estado de varios registros por sus IDs internos o externos.

**Query params:** `ids=45,46,47` (IDs internos) o `external_ids=DRP-C-00123,DRP-C-00124&source_name=DROPI`

**Response `200`:**

```json
{
  "data": [
    { "id": 45, "external_id": "DRP-C-00123", "sync_status": "synced",  "erp_record_id": "CUST-0001" },
    { "id": 46, "external_id": "DRP-C-00124", "sync_status": "pending", "erp_record_id": null },
    { "id": 47, "external_id": "DRP-C-00125", "sync_status": "blocked", "erp_record_id": null }
  ]
}
```

---

### 5.2 Disparadores de sincronización

#### `POST /sync/trigger`

Dispara sincronización inmediata. Puede ser uno, varios o todos los pendientes de una fuente.

**Request (un registro por ID interno):**

```json
{ "record_ids": [45] }
```

**Request (varios):**

```json
{ "record_ids": [45, 46, 47] }
```

**Request (todos los pending de una fuente):**

```json
{ "source_name": "DROPI", "entity_type": "customer", "sync_status": "pending" }
```

**Response `200`:**

```json
{
  "triggered": 3,
  "message": "Sincronización iniciada en background"
}
```

> El proceso corre de forma asíncrona. Usar `GET /sync/status` para consultar el resultado.

---

#### `POST /sync/requeue/:id`

Vuelve a encolar un registro en estado `blocked` para que se reintente.

**Response `200`:**

```json
{
  "record_id": 47,
  "previous_status": "blocked",
  "new_status": "pending",
  "attempts_reset": true
}
```

---

### 5.3 Administración de fuentes

#### `GET /admin/sources`

Lista todas las fuentes registradas con su estado.

**Response `200`:**

```json
{
  "data": [
    { "id": 1, "source_name": "DROPI",  "erp_version": "v16", "is_active": true },
    { "id": 2, "source_name": "MANUAL", "erp_version": "v16", "is_active": true }
  ]
}
```

---

#### `PUT /admin/sources/:id`

Activa o desactiva una fuente.

**Request:**

```json
{ "is_active": false }
```

**Response `200`:**

```json
{ "id": 1, "source_name": "DROPI", "is_active": false }
```

---

#### `GET /admin/dashboard`

Sirve el HTML del panel de administración.

---

## 6. Lógica del Sync Engine

### 6.1 Ciclo del scheduler

```
┌─────────────────────────────────────────────────────────────┐
│  SyncEngine.runBatch()                                      │
│                                                             │
│  1. Leer parámetros (batch_size, retry_delay, timeout...)  │
│                                                             │
│  2. SELECT registros procesables:                           │
│     WHERE sync_status IN ('pending', 'error')               │
│     AND source activa (JOIN erpsync_sources)                │
│     AND (next_attempt_at IS NULL                            │
│          OR next_attempt_at <= NOW())                       │
│     AND attempts < max_attempts                             │
│     ORDER BY entity_type_priority ASC, created_at ASC      │
│     LIMIT batch_size                                        │
│     FOR UPDATE SKIP LOCKED  ← evita procesamiento doble    │
│                                                             │
│  3. Por cada registro → SyncEngine.processOne(record)      │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Procesamiento de un registro

```
SyncEngine.processOne(record)
│
├─ Marcar sync_status = 'processing'
│
├─ Construir payload ERPNext
│  └─ Transformer.build(entity_type, erp_version, record.payload)
│
├─ Verificar si ya existe en ERPNext
│  └─ ErpClient.get(erp_doctype, identifier)
│     ├─ 200 → existe → usar PUT
│     └─ 404 → no existe → usar POST
│
├─ Ejecutar llamada HTTP (POST o PUT)
│
├─ Escribir en erpsync_log (siempre, éxito o error)
│
├─ SI ÉXITO (2xx):
│  ├─ sync_status = 'synced'
│  ├─ erp_record_id = response.data.name
│  ├─ erp_method = 'POST' o 'PUT'
│  └─ attempts++
│
└─ SI ERROR:
   ├─ attempts++
   ├─ last_error_code = clasificar_error(http_status, body)
   ├─ last_error_msg = mensaje descriptivo
   ├─ SI attempts >= max_attempts:
   │  └─ sync_status = 'blocked'
   └─ SI attempts < max_attempts:
      ├─ sync_status = 'error'
      └─ next_attempt_at = NOW() + retry_delay_min
```

### 6.3 Prioridad de procesamiento

Cuando hay registros de distintos `entity_type`, el engine los procesa en este orden para respetar dependencias en ERPNext:

| Prioridad | entity_type     | Razón                              |
| --------- | --------------- | ----------------------------------- |
| 1         | `customer`    | Debe existir antes que las órdenes |
| 2         | `item`        | Debe existir antes que las órdenes |
| 3         | `sales_order` | Depende de customer e item          |

### 6.4 Identificador único para búsqueda en ERPNext

El engine necesita saber cómo buscar si un registro ya existe en ERPNext antes de decidir entre POST y PUT. Por `entity_type`:

| entity_type     | Campo a buscar en ERPNext                  | Ejemplo                                                                                 |
| --------------- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `customer`    | `email_id` o `name`                    | `GET /api/resource/Customer?filters=[["Customer","email_id","=","maria@correo.com"]]` |
| `item`        | `item_code`                              | `GET /api/resource/Item/CAMISETA-001-ROJO-M`                                          |
| `sales_order` | `external_id` en campo custom o `name` | configurable                                                                            |

El campo identificador se configura por `entity_type` en parámetros o en la lógica del transformer.

---

## 7. Transformadores (por versión ERPNext)

Como los datos ya llegan en formato estándar del módulo, los transformadores solo convierten ese formato al payload exacto que necesita ERPNext según su versión. No hay transformadores por fuente.

```
/transformers/
  v16/
    customer.js       ← payload.* → Customer ERPNext v16
    item.js           ← payload.* → Item ERPNext v16
    sales_order.js    ← payload.* → Sales Order ERPNext v16
  v15/
    customer.js
    ...
```

### Ejemplo: transformer de cliente v16

```javascript
// transformers/v16/customer.js

module.exports = function buildCustomerPayload(payload, params) {
  // payload: lo que envió el sistema externo
  // params: parámetros del sistema (customer_group, territory, etc.)
  return {
    doctype: "Customer",
    customer_name: payload.customer_name,
    customer_type: payload.customer_type || "Individual",
    customer_group: payload.customer_group || params.ERPSYNC_CUSTOMER_GROUP,
    territory: payload.territory || params.ERPSYNC_TERRITORY,
    mobile_no: payload.mobile_no || null,
    email_id: payload.email_id || null
  };
};
```

### Contrato del payload para clientes (lo que debe enviar el sistema externo)

```json
{
  "customer_name": "María García",       ← REQUERIDO
  "email_id": "maria@correo.com",        ← recomendado (se usa para buscar duplicados)
  "mobile_no": "3001234567",             ← opcional
  "customer_type": "Individual",         ← opcional (default: Individual)
  "customer_group": "Individual",        ← opcional (default: parámetro ERPSYNC_CUSTOMER_GROUP)
  "territory": "Colombia"                ← opcional (default: parámetro ERPSYNC_TERRITORY)
}
```

---

## 8. Manejo de Errores

### Clasificación y comportamiento

| Código interno  | HTTP ERPNext | Descripción                               | ¿Reintentable? | Acción                                        |
| ---------------- | ------------ | ------------------------------------------ | --------------- | ---------------------------------------------- |
| `DUPLICATE`    | 409          | Ya existe con mismo name                   | No              | Hacer PUT automático                          |
| `LINK_ERROR`   | 417          | Referencia rota (customer_group no existe) | No              | Bloqueado, requiere corrección de parámetros |
| `VALIDATION`   | 417          | Campo requerido vacío o formato inválido | No              | Bloqueado, revisar payload                     |
| `AUTH_ERROR`   | 401/403      | Credenciales ERPNext inválidas            | No              | Bloqueado, revisar parámetro ERPSYNC_ERP_AUTH |
| `NOT_FOUND`    | 404          | DocType o endpoint incorrecto              | No              | Bloqueado, revisar configuración              |
| `NETWORK`      | timeout      | Error de red o ERPNext caído              | Sí             | Reintentar con delay                           |
| `SERVER_ERROR` | 500          | Error interno de ERPNext                   | Sí             | Reintentar con delay                           |
| `TRANSFORM`    | —           | Error al construir el payload              | No              | Bloqueado, revisar transformer                 |

> **Nota sobre DUPLICATE (409):** el engine primero hace un GET para verificar si existe. Un 409 en el POST normalmente indica una condición de carrera. En ese caso se hace un PUT de inmediato como fallback, sin contar como error.

### Reintentos automáticos

```
Scheduler corre → encuentra registro con sync_status='error'
  └─ Verifica: next_attempt_at <= NOW()
     └─ Sí → intenta de nuevo
        └─ Si falla y attempts < max → actualiza next_attempt_at = NOW() + retry_delay
        └─ Si falla y attempts >= max → sync_status = 'blocked'
```

---

## 9. Panel de Administración (HTML)

Panel web simple servido por el propio módulo en `/admin/dashboard`. Sin framework de frontend, HTML + JS vanilla o mínimo.

### Vistas requeridas

**Dashboard principal:**

- Contadores por estado: pending / processing / synced / error / blocked / skipped
- Filtro por fuente (`source_name`) y tipo de entidad (`entity_type`)
- Tabla paginada de registros con columnas: ID, fuente, tipo, external_id, estado, ERP ID, intentos, última actualización
- Botón de acción por fila: "Ver detalle", "Reintentar" (si está en error/blocked)

**Detalle de registro:**

- Datos del registro: payload enviado, estado actual, ERP record ID
- Tabla de historial de intentos (del `erpsync_log`): fecha, método HTTP, status HTTP, duración, resultado

**Ingreso manual de registros:**

- Formulario para seleccionar fuente, tipo de entidad e ingresar payload en JSON
- Botón "Encolar" y opción "Encolar y sincronizar ahora"

**Gestión de fuentes:**

- Tabla de fuentes con toggle de activo/inactivo
- Botón "Sincronizar todos los pending" por fuente

---

## 10. Estructura del Código

```
/erp-sync/
│
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── records.routes.js      ← /api/records
│   │   │   ├── sync.routes.js         ← /sync/*
│   │   │   └── admin.routes.js        ← /admin/*
│   │   └── server.js                  ← Express app
│   │
│   ├── engine/
│   │   └── SyncEngine.js              ← lógica principal de sincronización
│   │
│   ├── transformers/
│   │   ├── index.js                   ← Transformer.build(entity_type, version, payload)
│   │   ├── v16/
│   │   │   ├── customer.js
│   │   │   ├── item.js
│   │   │   └── sales_order.js
│   │   └── v15/
│   │       └── customer.js
│   │
│   ├── client/
│   │   └── ErpNextClient.js           ← HTTP client para ERPNext API
│   │
│   ├── repository/
│   │   ├── RecordsRepository.js       ← queries sobre erpsync_incoming_records
│   │   ├── LogRepository.js           ← queries sobre erpsync_log
│   │   └── SourcesRepository.js       ← queries sobre erpsync_sources
│   │
│   ├── scheduler/
│   │   └── index.js                   ← node-cron, lee parámetro ERPSYNC_CRON
│   │
│   └── config/
│       └── params.js                  ← lee parámetros desde tabla de parámetros
│
├── public/
│   └── admin/
│       ├── index.html                 ← panel dashboard
│       ├── detail.html                ← detalle de registro
│       └── app.js                     ← lógica frontend del panel
│
├── migrations/
│   ├── 001_create_erpsync_sources.sql
│   ├── 002_create_erpsync_incoming_records.sql
│   └── 003_create_erpsync_log.sql
│
├── package.json
└── README.md
```

---

## 11. Plan de Desarrollo por Etapas

### Etapa 1 — Clientes (alcance actual)

- [ ] Crear tablas (`erpsync_sources`, `erpsync_incoming_records`, `erpsync_log`)
- [ ] Insertar fuente DROPI y parámetros iniciales
- [ ] `POST /api/records` — recepción de clientes desde DROPI
- [ ] `GET /api/records` y `GET /api/records/:id`
- [ ] `GET /sync/status`
- [ ] Transformer `v16/customer.js`
- [ ] `ErpNextClient.js` — GET, POST, PUT a ERPNext
- [ ] `SyncEngine.processOne()` para clientes
- [ ] Scheduler con `node-cron`
- [ ] `POST /sync/trigger` y `POST /sync/requeue/:id`
- [ ] `GET /admin/sources` y `PUT /admin/sources/:id`
- [ ] Panel admin HTML básico (dashboard + detalle)
- [ ] Pruebas end-to-end con ERPNext en desarrollo

### Etapa 2 — Productos e Ítems

- [ ] Transformer `v16/item.js`
- [ ] Endpoints para entity_type = `item`
- [ ] Soporte a variantes (Color + Talla)

### Etapa 3 — Órdenes de Venta

- [ ] Transformer `v16/sales_order.js`
- [ ] Lógica de dependencias (verificar que cliente e ítem existan en ERP antes de sincronizar orden)

### Etapa 4 — Shopify

- [ ] Registrar fuente SHOPIFY en `erpsync_sources`
- [ ] Documentar contrato de payload para Shopify
- [ ] No se requieren transformadores nuevos (la transformación es por versión ERP, no por fuente)

---

## 12. Preguntas Pendientes

Las siguientes definiciones son necesarias antes de iniciar el desarrollo de etapas posteriores. La Etapa 1 puede arrancar sin estas respuestas.

### 12.1 Identificación de clientes en ERPNext

- ¿Qué campo identifica de forma única a un cliente en ERPNext: `email_id`, un campo custom con el ID de DROPI, o el `name` generado por ERPNext? Esto define la lógica de búsqueda antes del POST/PUT.
- ¿Se debe guardar el `external_id` de DROPI en algún campo custom de ERPNext para trazabilidad?

### 12.2 Comportamiento al reenviar datos

- Si el sistema externo envía el mismo `external_id` con datos actualizados (ej: cambió el teléfono), ¿siempre se reencola para actualizar en ERPNext, o solo si hay diferencias en el payload?

### 12.3 Órdenes de venta (Etapa 3)

- ¿Las órdenes se crean en ERPNext en estado **borrador** (`docstatus=0`) o **confirmadas** (`docstatus=1`) directamente?
- ¿Cuál es el contrato mínimo de campos que debe traer una orden del sistema externo?

### 12.4 Panel de administración

- ¿El panel necesita autenticación (usuario/contraseña simple) o es solo para red interna sin auth?
- ¿Hay un diseño o paleta de colores corporativa que deba seguir?

---

*Documento versión 2.0 — Etapa 1 lista para desarrollo.*
