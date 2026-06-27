# Plan de Trabajo por Días — Plataforma de Importación (MVP)

> **Decisiones confirmadas:**
> - Identificador único de Dropi: `dropi_id` (⚠️ confirmar nombre exacto de columna en el Excel real antes del Día 1)
> - Columnas del Excel: las definidas en el DDL de `stg_dropi_order` son el contrato; si el archivo no las trae, la fila se rechaza con error descriptivo
> - Concurrencia: un job a la vez por ahora; arquitectura lista para escalar
> - Procesamiento: fila a fila (streaming row-by-row dentro del worker)
> - API Keys: solo `READ` por defecto; se puede extender a `WRITE` por key individual
> - Auditoría: logs estructurados en stdout (JSON) — sin tabla `audit_log` hasta tener usuarios reales
> - DELETE/retry de jobs: disponible directo en BD por ahora; endpoints en Fase 2

---

## Visión General del Plan MVP

| Sprint | Días | Foco |
|--------|------|------|
| **Sprint 0** | Días 1–2 | Spike con Excel real + BD base |
| **Sprint 1** | Días 3–4 | Auth JWT |
| **Sprint 2** | Días 5–6 | Subida de archivos + Import Jobs |
| **Sprint 3** | Días 7–9 | Worker row-by-row + Staging + UPSERT |
| **Sprint 4** | Días 10–11 | Dashboard mínimo |
| **Sprint 5** | Días 12–13 | API Key + endpoint de pedidos |

---

## Sprint 0 — Spike con Excel Real y BD Base
**Días 1 al 2**

El primer sprint valida el contrato de datos antes de construir nada encima. Si el Excel no se puede leer bien, el proyecto no tiene sentido. Hacerlo primero evita rehacer el lector y el DDL en el Día 7.

---

### Día 1 — Spike: leer el Excel real con POI

**Meta:** confirmar que Apache POI puede leer el Excel de Dropi real, que los nombres de columnas coinciden con el DDL, y que `dropi_id` tiene el nombre exacto esperado.

**Tareas:**

1. Crear un script Java standalone (sin Spring, sin BD) que use Apache POI (`XSSFWorkbook`) para abrir el Excel de Dropi real.

2. Imprimir los encabezados de la primera fila tal como aparecen en el archivo:
   ```java
   Row header = sheet.getRow(0);
   for (Cell cell : header) {
       System.out.println("[" + cell.getColumnIndex() + "] '" + cell.getStringCellValue() + "'");
   }
   ```

3. Confirmar o corregir el nombre exacto de `dropi_id` (puede ser `"Dropi ID"`, `"ID Dropi"`, `"dropi_id"`, etc.).

4. Leer las primeras 5 filas de datos e imprimir los valores para verificar tipos (fechas, números, texto).

5. Con los nombres reales, ajustar el DDL de `stg_dropi_order` si es necesario.

6. Documentar en un comentario en el código: nombre exacto de cada columna del Excel → campo del DDL.

**Criterio de aceptación:**
- El script imprime los encabezados reales sin excepción
- Se confirma el nombre exacto de `dropi_id`
- El DDL queda ajustado si hubo diferencias

---

### Día 2 — Proyecto, Docker Compose y migraciones SQL

**Meta:** el stack corre con `docker compose up` y la BD tiene el esquema base aplicado.

**Tareas:**

1. Crear repo con estructura de carpetas (arquitectura hexagonal):
   ```
   src/
     domain/          ← entidades, interfaces de repositorio
     application/     ← casos de uso / servicios
     infrastructure/  ← JPA, controladores, config
   ```

2. Configurar `docker-compose.yml` con servicios `db` y `app` y volúmenes:
   ```yaml
   volumes:
     db_data:
     files_data:
   ```

3. Configurar Flyway. Primera migración `V1__init.sql` con:
   - `tenants`
   - `users`
   - `files`
   - `import_jobs`
   - `stg_dropi_order` (con los nombres de columna confirmados en el Día 1)
   - `pedidos`
   - Índices compuestos

4. Insertar tenant y usuario admin de prueba en la migración `V1__init.sql` (datos semilla, password hasheado con BCrypt).

5. Crear entidades JPA y repositorios para todas las tablas: `Tenant`, `User`, `ImportFile`, `ImportJob`, `StgDropiOrder`, `Pedido`.

6. Verificar que `docker compose up` levanta Postgres, aplica migraciones y la app arranca sin errores.

**Criterio de aceptación:**
- `docker compose up` no lanza errores
- `SELECT * FROM tenants;` devuelve al menos 1 fila
- Todas las tablas existen en BD

> **Nota:** al consolidar las migraciones en un solo día, se evita el overhead de ir creando tablas en sprints separados. El contrato de datos ya fue validado en el Día 1.

---

## Sprint 1 — Autenticación JWT
**Días 3 al 4**

Al final del sprint se puede hacer `POST /api/auth/login` y recibir un token válido.

> **Nota:** este sprint tiene margen de 2 días porque Spring Security stateless con filtros personalizados es el punto donde más equipos se atascan. Es normal que tome más de lo esperado.

---

### Día 3 — Login con JWT (parte 1)

**Meta:** `POST /api/auth/login` devuelve un JWT válido con `tenant_id`, `user_id` y `role` en el payload.

**Tareas:**

1. Agregar dependencia JWT (`jjwt` o `nimbus-jose-jwt`).

2. Crear `AuthController` con endpoint:
   ```
   POST /api/auth/login
   Body: { "username": "admin", "password": "secret" }
   ```

3. Implementar `AuthService`:
   - Buscar usuario por `(tenant_id, username)` — el `tenant_id` viene de un header `X-Tenant-ID`
   - Verificar password con BCrypt
   - Generar JWT con claims: `sub` (userId), `tenantId`, `role`, `exp` (1h)

4. Configurar Spring Security: desactivar sesión (stateless), permitir `/api/auth/**` sin autenticación, proteger el resto.

**Criterio de aceptación:**
```bash
curl -X POST /api/auth/login -d '{"username":"admin","password":"secret"}' 
→ 200 { "accessToken": "eyJ...", "expiresIn": 3600 }
```

---

### Día 4 — Filtro JWT y endpoint de verificación

**Meta:** el filtro JWT valida el token en cada request y el sistema rechaza correctamente tokens inválidos.

**Tareas:**

1. Crear filtro `JwtAuthFilter` que, en cada request, lee `Authorization: Bearer <token>`, valida firma y exp, e inyecta el contexto de seguridad con `tenantId` y `role`.

2. Agregar endpoint `GET /api/auth/me` (protegido) que devuelve los datos del usuario autenticado.

3. Log estructurado en stdout para eventos de auth:
   ```json
   {"timestamp":"2026-06-27T10:00:00Z","action":"LOGIN","tenantId":1,"userId":1,"result":"SUCCESS"}
   {"timestamp":"2026-06-27T10:01:00Z","action":"LOGIN","tenantId":1,"userId":null,"result":"FAILED"}
   ```

4. Test: login exitoso → token válido; sin token → 401; token expirado → 401.

**Criterio de aceptación:**
```bash
# Token válido
curl -H "Authorization: Bearer eyJ..." /api/auth/me
→ 200 { "id": 1, "username": "admin", "role": "ADMIN", "tenantId": 1 }

# Sin token
curl /api/auth/me
→ 401
```

---

## Sprint 2 — Subida de Archivos e Import Jobs
**Días 5 al 6**

Al final del sprint se puede subir un Excel por API, el sistema lo guarda en el volumen, crea el registro en `files` y crea un `import_job` en estado `PENDING`.

---

### Día 5 — Endpoint de subida de archivo

**Meta:** `POST /api/files/upload` recibe un Excel, lo guarda en disco y crea el job.

**Tareas:**

1. Crear `FileController` con endpoint:
   ```
   POST /api/files/upload
   Content-Type: multipart/form-data
   Body: file=<excel.xlsx>
   ```

2. Implementar `FileService.upload(MultipartFile, tenantId, userId)`:
   - Validar que el archivo es `.xlsx` o `.xls`
   - Calcular SHA-256 del contenido
   - Guardar en disco en `/app/files/{tenantId}/{uuid}-{filename}`
   - Insertar en tabla `files` con status `UPLOADED`
   - Crear `import_job` en status `PENDING`, template `DROPI_ORDER`, rowsTotal `null`
   - Retornar `{ "jobId": 42, "fileId": 7, "message": "Archivo recibido, procesando." }`

3. Configurar Spring para aceptar archivos grandes (`spring.servlet.multipart.max-file-size=50MB`).

4. Manejar error si el archivo ya existe (mismo SHA-256 para el mismo tenant): retornar `409 Conflict`.

5. Log estructurado:
   ```json
   {"timestamp":"...","action":"UPLOAD_FILE","tenantId":1,"userId":1,"fileId":7,"jobId":42}
   ```

6. Test de integración: subir un `.xlsx` de prueba y verificar que se crea el job en BD con status `PENDING`.

**Criterio de aceptación:**
```bash
curl -X POST /api/files/upload \
  -H "Authorization: Bearer eyJ..." \
  -F "file=@Dropi_2026-06.xlsx"
→ 201 { "jobId": 42, "fileId": 7 }

SELECT status FROM import_jobs WHERE id = 42;
→ PENDING
```

---

### Día 6 — Endpoints de consulta de jobs

**Meta:** se puede listar y ver el detalle de un job por API.

**Tareas:**

1. Crear `ImportJobController` con endpoints:
   ```
   GET  /api/import-jobs          → lista paginada
   GET  /api/import-jobs/{id}     → detalle
   ```

   > DELETE y retry se omiten del MVP. En producción inicial se hacen directo en BD para tener visibilidad completa de todos los intentos.

2. Implementar `ImportJobService`:
   - `listByTenant(tenantId, status?, page, size)` — filtro por status opcional
   - `getById(tenantId, jobId)` — valida que el job pertenece al tenant (403 si no)

3. DTO de respuesta de job con campo calculado:
   ```json
   {
     "id": 42,
     "status": "RUNNING",
     "progress": 37,
     "rowsDone": 370,
     "rowsTotal": 1000,
     "file": "Dropi_2026-06.xlsx",
     "template": "DROPI_ORDER",
     "startedAt": "2026-06-27T10:00:00Z",
     "finishedAt": null,
     "errorMsg": null
   }
   ```
   `progress = rowsDone * 100 / rowsTotal` (0 si rowsTotal es null)

4. Validación de tenant en cada operación.

**Criterio de aceptación:**
```bash
GET /api/import-jobs
→ 200 [ { "id": 42, "status": "PENDING", "progress": 0, ... } ]

GET /api/import-jobs/42
→ 200 { detalle completo }

GET /api/import-jobs/999  (de otro tenant)
→ 403
```

---

## Sprint 3 — Worker Row-by-Row, Staging y UPSERT
**Días 7 al 9**

El sprint más técnico. Al final, el worker procesa el Excel fila a fila, guarda cada fila en `stg_dropi_order` y hace UPSERT en `pedidos`, actualizando el progreso en tiempo real.

> **Nota:** el Día 8 (`FOR UPDATE SKIP LOCKED`) tiene margen extra incluido — el locking en PostgreSQL tiene trampas y el primer intento suele tener un bug de concurrencia sutil.

---

### Día 7 — Lector de Excel y carga a staging

**Meta:** el lector de Excel funciona con el archivo real y carga filas en `stg_dropi_order`.

**Tareas:**

1. Crear `DropiExcelReader` usando Apache POI streaming (`SXSSFWorkbook` o `XSSFWorkbook`) para leer fila a fila:
   - Leer encabezados de la primera fila
   - Validar que las columnas obligatorias existen (usando los nombres confirmados en el Día 1)
   - Por cada fila de datos, retornar un `Map<String, String>` con los valores

2. Columnas obligatorias como constante:
   ```java
   Set<String> REQUIRED_COLUMNS = Set.of(
     "dropi_id", "fecha", "nombre_cliente", "telefono",
     "estatus", "total_orden", "vendedor", "tienda_id"
   );
   ```

3. Crear interfaz `ImportProcessor`:
   ```java
   interface ImportProcessor {
       boolean supports(String template);
       void loadToStaging(ImportJob job, Path filePath);
   }
   ```

4. Implementar `DropiOrderProcessor.loadToStaging`:
   - Usar `DropiExcelReader` para iterar fila a fila
   - Guardar en batch cada 100 filas (`saveAll` + flush)
   - Actualizar `import_jobs.rows_total` al terminar de leer
   - Si falta columna obligatoria, marcar job como `ERROR` con mensaje

5. Test unitario: dado Excel válido → N filas en staging; sin `dropi_id` → excepción con mensaje `"Columnas obligatorias faltantes: [dropi_id]"`.

**Criterio de aceptación:**
- Test con Excel válido: devuelve filas correctamente
- Test con columna faltante: excepción descriptiva

---

### Día 8 — Worker scheduler y claim atómico de jobs

**Meta:** el worker toma jobs `PENDING` de forma atómica usando `FOR UPDATE SKIP LOCKED` y los procesa.

**Tareas:**

1. Crear `JobScheduler` con `@Scheduled(fixedDelay = 2000)`:
   - Tomar un job `PENDING` de forma atómica
   - Llamar al `ImportProcessor` adecuado
   - En excepción no controlada: marcar job como `ERROR`

2. Implementar `claimNextPending` con `@Query` nativo:
   ```sql
   UPDATE import_jobs SET status='RUNNING', started_at=NOW()
   WHERE id = (
     SELECT id FROM import_jobs
     WHERE status='PENDING'
     LIMIT 1
     FOR UPDATE SKIP LOCKED
   )
   RETURNING id
   ```

3. Al arrancar la app, detectar jobs huérfanos (`RUNNING` con `updated_at < NOW() - INTERVAL '10 minutes'`) y resetearlos a `PENDING`:
   ```json
   {"timestamp":"...","action":"JOB_RECOVERED","tenantId":1,"jobId":42}
   ```

4. Si el archivo en disco no existe al procesar: marcar job como `ERROR` con mensaje `"Archivo no encontrado en almacenamiento"`.

5. Si el Excel está corrupto (excepción de POI): marcar job como `ERROR` con mensaje descriptivo.

**Criterio de aceptación:**
```bash
# Subir Excel y esperar ~3 segundos
curl -X POST /api/files/upload -F "file=@Dropi.xlsx" -H "Authorization: Bearer ..."

SELECT status FROM import_jobs WHERE id = 42;                     → RUNNING
SELECT COUNT(*) FROM stg_dropi_order WHERE import_job_id = 42;   → N filas
```

---

### Día 9 — Procesamiento fila a fila con UPSERT en pedidos

**Meta:** el worker procesa cada fila de staging con UPSERT en `pedidos`, actualizando el progreso fila a fila.

**Tareas:**

1. Implementar segunda fase `DropiOrderProcessor.processStaging(ImportJob job)`:
   - Consultar filas `stg_dropi_order` con `processing_status='PENDING'` de a **1 fila por iteración**
   - Por cada fila:
     - Parsear y validar: `dropi_id` no vacío, `fecha` parseable, `total_orden` numérico; si falla → `processing_status='ERROR'`
     - Ejecutar UPSERT en `pedidos`:
       ```sql
       INSERT INTO pedidos (tenant_id, dropi_id, fecha, ...)
       VALUES (...)
       ON CONFLICT (tenant_id, dropi_id) DO UPDATE SET
         fecha = EXCLUDED.fecha, estatus = EXCLUDED.estatus, ...
         updated_at = NOW()
       ```
     - Marcar `stg.processing_status='PROCESSED'`, `processed_at=NOW()`
     - Incrementar `import_jobs.rows_done = rows_done + 1`
   - Al terminar: `import_jobs.status='COMPLETED'`, `finished_at=NOW()`
   - Log estructurado al completar:
     ```json
     {"timestamp":"...","action":"JOB_COMPLETED","tenantId":1,"jobId":42,"rowsDone":1000,"errors":2}
     ```

2. Capturar excepciones por fila individualmente — un error de fila no detiene el job.

3. Si hay error fatal (BD caída), marcar job como `ERROR`.

4. `GlobalExceptionHandler` con `@ControllerAdvice`:
   ```json
   { "error": "FILE_NOT_FOUND", "message": "El archivo no existe", "status": 404 }
   ```

5. Test end-to-end: Excel de 50 filas (2 con `total_orden` no numérico):
   - `import_jobs.status = 'COMPLETED'`, `rows_done = 50`
   - `pedidos` tiene 48 filas; UPSERT no duplica al subir el mismo Excel de nuevo

**Criterio de aceptación:**
```bash
GET /api/import-jobs/42
→ { "status": "COMPLETED", "progress": 100, "rowsDone": 50, "rowsTotal": 50 }

SELECT COUNT(*) FROM pedidos WHERE tenant_id = 1;  → 48
```

---

## Sprint 4 — Dashboard Mínimo
**Días 10 al 11**

Al final del sprint hay una UI funcional (React/Vite) que muestra login, lista de jobs con progreso y subida de archivo. Sin toasts ni polling sofisticado — lo mínimo para que sea usable.

---

### Día 10 — Setup frontend, login y lista de jobs

**Meta:** proyecto React/Vite corriendo en Docker con login funcional y lista de jobs.

**Tareas:**

1. Crear proyecto Vite + React + TypeScript en `/frontend`.

2. Agregar servicio `frontend` en `docker-compose.yml` con hot reload en dev.

3. Configurar cliente HTTP (Axios o fetch) con interceptor que agrega `Authorization: Bearer <token>`.

4. Crear pantalla `/login`:
   - Form con `username` y `password`
   - Al hacer submit llama `POST /api/auth/login`
   - Guarda el token en memoria (React context) — **no en localStorage**
   - Redirige a `/importaciones` si exitoso; muestra error si no

5. Guard de rutas: sin token → redirect a `/login`.

6. Crear página `/importaciones` con `JobList`: tabla con columnas `Archivo`, `Estado`, `Progreso`, `Inicio`, `Fin`.

7. Badge de color por estado: `PENDING` → gris, `RUNNING` → azul, `COMPLETED` → verde, `ERROR` → rojo.

**Criterio de aceptación:**
- Login correcto redirige a `/importaciones`
- Login incorrecto muestra "Credenciales inválidas"
- La lista de jobs carga y muestra los estados con color

---

### Día 11 — Subida de archivo y polling básico

**Meta:** desde la UI se puede subir un Excel y ver el progreso actualizarse automáticamente.

**Tareas:**

1. Botón "Subir archivo" que abre selector (solo `.xlsx`) y hace `POST /api/files/upload`.

2. Barra de progreso visual para jobs `RUNNING` y `COMPLETED`.

3. Polling simple: `useEffect` con `setInterval` de 2 segundos que llama `GET /api/import-jobs` mientras hay jobs activos; se detiene cuando todos están `COMPLETED` o `ERROR`.

   > Sin toasts, sin animaciones complejas. Basta con que la barra avance y el badge cambie.

4. Si el polling falla por red, no romper la UI — solo reintentar en el siguiente intervalo.

5. Al completar la subida inicial, agregar el nuevo job a la lista sin recargar la página.

**Criterio de aceptación:**
- Subir un Excel muestra el job nuevo en la lista con estado `PENDING`
- La barra de progreso avanza en tiempo real mientras el job está `RUNNING`
- Al completar, el badge cambia a verde

---

## Sprint 5 — API Pública con API Keys
**Días 12 al 13**

Al final del sprint un cliente externo puede consultar pedidos usando una API Key.

---

### Día 12 — API Keys: gestión y autenticación

**Meta:** un admin puede crear y revocar API Keys; requests con `X-API-KEY` válido se autentican.

**Tareas:**

1. Crear `ApiKeyController` (protegido con JWT, solo `ADMIN`):
   ```
   POST   /api/api-keys      → genera y devuelve la key (solo esta vez)
   GET    /api/api-keys      → lista keys del tenant (sin mostrar el valor)
   DELETE /api/api-keys/{id} → revoca key (is_active = false)
   ```

2. Implementar `ApiKeyService.create(tenantId, name, expiresAt?)`:
   - Generar UUID v4 como valor: `dropi_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - Calcular `SHA-256(key)` y guardar solo el hash en BD
   - Devolver el valor en texto plano **una sola vez**:
     ```json
     {
       "id": 5,
       "name": "Integración ERP",
       "key": "dropi_abc123...",
       "permissions": "READ",
       "warning": "Guarda esta clave. No se mostrará de nuevo."
     }
     ```

3. Crear `ApiKeyAuthFilter`:
   - Leer header `X-API-KEY`
   - Calcular `SHA256(value)`, buscar en BD por `key_hash` + `is_active=true`
   - Si encontrado: inyectar contexto de seguridad con `tenantId`; si no: `401`
   - Actualizar `last_used_at=NOW()` en cada request válido

4. Log estructurado:
   ```json
   {"timestamp":"...","action":"CREATE_API_KEY","tenantId":1,"userId":1,"keyId":5}
   ```

5. Test: key válida → autenticada; key inválida → 401; key revocada → 401.

**Criterio de aceptación:**
```bash
POST /api/api-keys -H "Authorization: Bearer ..." -d '{"name":"ERP"}'
→ 201 { "key": "dropi_abc...", "warning": "Guarda esta clave..." }

curl -H "X-API-KEY: invalida" /api/v1/pedidos
→ 401
```

---

### Día 13 — Endpoints públicos de pedidos

**Meta:** `GET /api/v1/pedidos` y `GET /api/v1/pedidos/{dropiId}` funcionan con API Key.

**Tareas:**

1. Crear `PedidoPublicoController` bajo `/api/v1/`:
   ```
   GET /api/v1/pedidos           → lista paginada (page, size, fecha_desde, fecha_hasta, estatus)
   GET /api/v1/pedidos/{dropiId} → detalle por dropi_id
   ```

2. `PedidoPublicoService` filtra siempre por `tenantId` del contexto de seguridad.

3. DTO de respuesta `PedidoDTO`:
   ```json
   {
     "dropiId": "12345",
     "fecha": "2026-06-01",
     "nombreCliente": "Juan Pérez",
     "telefono": "3001234567",
     "estatus": "ENTREGADO",
     "totalOrden": 150000.00,
     "ganancia": 25000.00,
     "transportadora": "Servientrega",
     "ciudad": "Medellín",
     "vendedor": "vendedor1",
     "tienda": "Mi Tienda",
     "numeroGuia": "TG123456"
   }
   ```

4. Paginación por defecto: `page=0, size=50, max=200`. Rechazar `size > 200` con `400`.

5. Rate limiting en memoria: máximo 100 requests/minuto por API Key con `ConcurrentHashMap` — suficiente para la primera fase.

6. JWT no debe funcionar en la API pública (solo API Key).

**Criterio de aceptación:**
```bash
curl -H "X-API-KEY: dropi_abc..." "/api/v1/pedidos?fecha_desde=2026-06-01&estatus=ENTREGADO"
→ 200 { "content": [...], "totalElements": 243, "page": 0, "size": 50 }

curl -H "Authorization: Bearer ..." /api/v1/pedidos
→ 401
```

---

## Resumen de Entregables por Sprint

| Sprint | Días | Entregable verificable |
|--------|------|------------------------|
| Sprint 0 | D1–D2 | Excel real leído correctamente; BD con todas las tablas |
| Sprint 1 | D3–D4 | `POST /api/auth/login` devuelve JWT válido |
| Sprint 2 | D5–D6 | `POST /api/files/upload` crea job; `GET /api/import-jobs` lista jobs |
| Sprint 3 | D7–D9 | Worker procesa Excel fila a fila; `pedidos` tiene datos; UPSERT funciona |
| Sprint 4 | D10–D11 | Dashboard con barra de progreso en tiempo real |
| Sprint 5 | D12–D13 | `GET /api/v1/pedidos` funciona con API Key |

---

## Qué queda para Fase 2

Lo siguiente fue movido de forma deliberada — no es que sea opcional, sino que solo vale la pena cuando hay usuarios reales en producción:

- **Auditoría formal** (`audit_log` en BD): los logs en stdout son suficientes para debuggear la primera fase. Cuando se necesite consultar historial desde la UI, se construye.
- **DELETE y retry de jobs por API**: útil cuando hay una UI de operaciones. En la fase inicial, hacerlo en BD da más visibilidad.
- **Prueba de carga (5,000 filas)**: validar con datos reales antes de optimizar.
- **Hardening de Docker** (healthchecks, variables de entorno de producción): aplicar antes de abrir a usuarios externos.
- **Toasts y polling sofisticado en UI**: con el polling básico ya se ve el progreso.
- Normalización de staging a tablas de productos, clientes, estadísticas
- Soporte de nuevos orígenes (Shopify, WooCommerce)
- WebSockets en lugar de polling para mayor escala
- Métricas Prometheus + Grafana

---

*13 días en lugar de 18. Todo lo que importa funciona; nada que no se va a usar en el primer mes.*

*Cada día tiene criterios de aceptación concretos. Si un día se atrasa, el siguiente se ajusta — los sprints son bloques coherentes y cada uno deja el sistema en un estado funcional.*