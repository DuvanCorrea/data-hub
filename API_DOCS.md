# Data Hub - Documentación de API y Datos Importantes

Esta documentación resume el estado actual del backend de Data Hub (Sprint 1 y 2), los endpoints disponibles y los detalles arquitectónicos más importantes.

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

## 2. Autenticación (JWT Stateless)

No hay sesiones ni cookies. Todo se basa en **tokens JWT**.

> A excepción del endpoint de Login, **todas las peticiones deben incluir esta cabecera**:
> ```
> Authorization: Bearer <TU_TOKEN_JWT>
> ```

---

## 3. Endpoints Disponibles

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

### Archivos y Jobs de Importación

#### `POST /api/files/upload`
Sube un archivo Excel de Dropi y crea un `ImportJob` en estado `PENDING`.

*   **Content-Type:** `multipart/form-data`
*   **Campo Form:** `file` — el archivo `.xlsx` o `.xls`
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
*   **Error `400`:** Extensión no permitida.
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
            "status": "PENDING",
            "progress": 0,
            "rowsDone": 0,
            "rowsTotal": 0,
            "template": "DROPI_ORDER",
            "startedAt": "",
            "finishedAt": "",
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

## 4. Manejo de Errores Estándar

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
| `400`  | Body/archivo inválido                             |
| `401`  | Sin token o credenciales incorrectas en login     |
| `403`  | Recurso de otro tenant / no encontrado            |
| `409`  | Conflicto (ej: archivo duplicado)                 |
| `500`  | Error interno — incluye campo `message` adicional |
