# Data Hub - Documentación de API y Datos Importantes

Esta documentación resume el estado actual del backend de Data Hub, los endpoints disponibles y los detalles arquitectónicos más importantes.

---

## 1. Datos Importantes del Entorno

| Parámetro             | Valor                          |
|-----------------------|--------------------------------|
| **URL Base (local)**  | `http://localhost:8080`        |
| **DB Host (local)**   | `localhost:5432`               |
| **Tenant Semilla**    | ID `1` — "Dropi Tools"         |
| **Usuario admin**     | `admin` / `admin123`           |
| **Almacenamiento**    | `/app/files/{tenantId}/` (volumen Docker `files_data`) |

*   **Control de Duplicados:** Se calcula SHA-256 de cada archivo al subirlo. Si el contenido es idéntico a uno ya subido, se rechaza con `409 Conflict`.
*   **Procesamiento Asíncrono:** La subida solo guarda el archivo y encola un `ImportJob` en `PENDING`. Un scheduler en segundo plano lo procesa con `FOR UPDATE SKIP LOCKED` para concurrencia segura.

---

## 2. Plantillas de Importación Soportadas

El campo `template` en `POST /api/files/upload` determina qué procesador y qué tabla staging se usa. Cada plantilla es completamente independiente — añadir una nueva no requiere cambios en el módulo de upload ni en el scheduler.

| `template`           | Archivo Dropi                   | Tabla Staging                  | Fase 2 (normalización)          |
|----------------------|---------------------------------|--------------------------------|---------------------------------|
| `DROPI_ORDER`        | Reporte de Órdenes              | `stg_dropi_order`              | UPSERT en `pedidos`             |
| `DOPI_ORDER_PRODUCT` | Reporte de Órdenes por Producto | `stg_dropi_order_product`      | Staging-only (sprint posterior) |

---

## 3. Autenticación (JWT Stateless)

No hay sesiones ni cookies. Todo se basa en **tokens JWT**.

> A excepción del endpoint de Login, **todas las peticiones deben incluir esta cabecera**:
> ```
> Authorization: Bearer <TU_TOKEN_JWT>
> ```

---

## 4. Endpoints Disponibles

### Auth

#### `POST /api/auth/login`
Obtiene el Token JWT.

*   **Headers:** `Content-Type: application/json`
*   **Body:**
    ```json
    {
      "username": "admin",
      "password": "admin123"
    }
    ```
*   **Respuesta `200 OK`:**
    ```json
    {
      "status": 200,
      "message": "Operación exitosa",
      "data": {
        "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
        "expiresIn": 3600
      },
      "timestamp": "2026-06-27T18:13:51Z"
    }
    ```
*   **Error `401`:** Credenciales inválidas o usuario inactivo.

---

#### `GET /api/auth/me`
Retorna el perfil del usuario autenticado.

*   **Respuesta `200 OK`:**
    ```json
    {
      "status": 200,
      "message": "Operación exitosa",
      "data": {
        "id": 1,
        "tenantId": 1,
        "username": "admin",
        "role": "ADMIN",
        "isActive": true,
        "createdAt": "2026-06-27T16:55:12.36213Z"
      },
      "timestamp": "2026-06-27T18:13:51Z"
    }
    ```

---

### Archivos y Jobs de Importación

#### `POST /api/files/upload`
Sube un archivo Excel de Dropi y crea un `ImportJob` en estado `PENDING`.

El campo `template` indica qué tipo de archivo se está subiendo.  El módulo de upload es genérico — el procesamiento correcto se selecciona automáticamente en segundo plano según el valor de `template`.

*   **Content-Type:** `multipart/form-data`
*   **Campos Form:**
    *   `file` — el archivo `.xlsx` o `.xls`
    *   `template` — tipo de plantilla (ver tabla de plantillas soportadas). Ejemplo: `DROPI_ORDER`, `DOPI_ORDER_PRODUCT`
*   **Respuesta `201 Created`:**
    ```json
    {
      "status": 201,
      "message": "Archivo recibido, procesando.",
      "data": {
        "jobId": 1,
        "fileId": 1
      },
      "timestamp": "2026-06-27T18:13:51Z"
    }
    ```
*   **Error `400`:** Extensión no permitida (solo `.xlsx` / `.xls`).
*   **Error `409`:** Archivo con el mismo contenido ya fue subido (SHA-256 duplicado).

---

#### `GET /api/import-jobs`
Lista los jobs de importación del tenant actual, paginados. Spring Data devuelve la estructura `Page<T>` estándar.

*   **Query Params (opcionales):**
    *   `status` — Filtra por: `PENDING`, `RUNNING`, `COMPLETED`, `ERROR`
    *   `page` — Número de página (default `0`)
    *   `size` — Elementos por página (default `20`)

*   **Respuesta `200 OK`:**
    ```json
    {
      "status": 200,
      "message": "Operación exitosa",
      "data": {
        "content": [
          {
            "id": 1,
            "status": "COMPLETED",
            "progress": 100,
            "rowsDone": 2,
            "rowsTotal": 2,
            "template": "DOPI_ORDER_PRODUCT",
            "startedAt": "2026-06-27T20:25:00Z",
            "finishedAt": "2026-06-27T20:25:01Z",
            "errorMsg": ""
          }
        ],
        "totalElements": 1,
        "totalPages": 1,
        "size": 20,
        "number": 0,
        "first": true,
        "last": true,
        "empty": false
      },
      "timestamp": "2026-06-27T18:13:51Z"
    }
    ```

---

#### `GET /api/import-jobs/{id}`
Consulta el estado y progreso de un job específico. Ideal para **polling** desde el frontend (cada 2–3 segundos).

*   **Respuesta `200 OK`:**
    ```json
    {
      "status": 200,
      "message": "Operación exitosa",
      "data": {
        "id": 1,
        "status": "RUNNING",
        "progress": 45,
        "rowsDone": 450,
        "rowsTotal": 1000,
        "template": "DROPI_ORDER",
        "startedAt": "2026-06-27T20:25:00Z",
        "finishedAt": "",
        "errorMsg": ""
      },
      "timestamp": "2026-06-27T18:13:51Z"
    }
    ```
*   **Error `403`:** El job no existe o no pertenece al tenant del token.

---

### Staging — Consulta de datos crudos

Los endpoints de staging devuelven las filas tal como fueron leídas del Excel, **antes** de cualquier transformación hacia tablas finales.  El parámetro `template` selecciona la tabla staging y las columnas correspondientes.

#### `GET /api/staging/{jobId}`
Devuelve una página de filas de staging filtrada por job específico.

*   **Path param:** `jobId` — ID del import job
*   **Query Params:**
    *   `template` — Requerido. Ej: `DROPI_ORDER`, `DOPI_ORDER_PRODUCT`
    *   `page` — (default `0`)
    *   `size` — (default `20`)
    *   `sortBy` — Campo de ordenación (ver columnas `SORTABLE` de cada plantilla, default `id`)
    *   `sortDir` — `asc` o `desc` (default `asc`)

*   **Respuesta `200 OK`:**
    ```json
    {
      "status": 200,
      "message": "Operación exitosa",
      "data": {
        "template": "DOPI_ORDER_PRODUCT",
        "columns": [
          { "key": "idDropi",   "label": "ID Dropi",  "type": "text"   },
          { "key": "producto",  "label": "Producto",  "type": "text"   },
          { "key": "cantidad",  "label": "Cantidad",  "type": "number" }
        ],
        "rows": [
          {
            "id": 1,
            "idDropi": "61934139",
            "producto": "Cargador retractil para carro",
            "cantidad": "1",
            "sku": "nova19",
            "estatus": "ENTREGADO"
          }
        ],
        "totalElements": 2,
        "totalPages": 1,
        "page": 0,
        "size": 20
      },
      "timestamp": "2026-06-27T18:13:51Z"
    }
    ```
*   **Error `400`:** Falta el parámetro `template`.
*   **Error `501`:** Plantilla no soportada (no existe un `StagingTableReader` para ese valor).

---

#### `GET /api/staging`
Devuelve una página con **todas** las filas del tenant para una plantilla dada (sin filtrar por job).

*   **Query Params:**
    *   `template` — Requerido. Ej: `DROPI_ORDER`, `DOPI_ORDER_PRODUCT`
    *   `page`, `size`, `sortBy`, `sortDir` — Igual que el endpoint anterior

*   **Respuesta:** Mismo esquema que `GET /api/staging/{jobId}`.

---

### Columnas sortables por plantilla

| Plantilla             | Campos sortables |
|-----------------------|-----------------|
| `DROPI_ORDER`         | `id`, `importJobId`, `rowNumber`, `processingStatus`, `idDropi`, `fechaDeReporte`, `estatus`, `nombreCliente`, `createdAt` |
| `DOPI_ORDER_PRODUCT`  | `id`, `importJobId`, `rowNumber`, `processingStatus`, `idDropi`, `fechaDeReporte`, `estatus`, `nombreCliente`, `productoId`, `sku`, `createdAt` |

---

## 5. Manejo de Errores Estándar

Todos los errores pasan por el `GlobalExceptionHandler` y tienen este formato uniforme:

```json
{
  "status": 409,
  "message": "Este archivo ya fue subido anteriormente (mismo contenido).",
  "data": null,
  "timestamp": "2026-06-27T18:13:51Z"
}
```

| Código | Situación                                         |
|--------|---------------------------------------------------|
| `400`  | Body/archivo inválido o parámetro requerido faltante |
| `401`  | Sin token o credenciales incorrectas en login     |
| `403`  | Recurso de otro tenant / no encontrado            |
| `409`  | Conflicto (ej: archivo duplicado)                 |
| `501`  | Plantilla no soportada en staging                 |
| `500`  | Error interno — incluye campo `message` adicional |

---

## 6. Extensibilidad — Cómo añadir una nueva plantilla

Para integrar un nuevo tipo de archivo sin modificar código existente:

1. **Migración SQL** — Crear `V{N}__add_stg_{nombre}.sql` con la nueva tabla staging.
2. **JPA Entity** — `StgNombreEntity.java` mapeada a esa tabla.
3. **Repository** — `StgNombreRepository.java` extendiendo `JpaRepository`.
4. **Processor** — `NombreProcessor.java` implementando `ImportProcessor`:
   - `supports(template)` devuelve `true` para el nuevo valor de `template`.
   - `loadToStaging()` lee el Excel y hace batch insert en la nueva tabla.
   - `processStaging()` implementa la lógica de negocio (o staging-only si aún no hay tabla final).
5. **StagingReader** — `NombreStagingReader.java` implementando `StagingTableReader`:
   - `getTemplate()` devuelve el mismo valor que el processor.
   - Define las columnas (`getColumns()`) y el mapeo entidad → `Map<String,Object>`.

El scheduler, el `StagingService` y todos los controllers descubren los nuevos beans automáticamente vía inyección de `List<ImportProcessor>` y `List<StagingTableReader>`.
