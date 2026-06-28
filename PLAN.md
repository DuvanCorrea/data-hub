# Plan de Trabajo — Plataforma de Importación (Data Hub)

## Estado Actual (Resumen Rápido)
Ya se construyó toda la infraestructura base, seguridad, subida de archivos, panel de control y el **visor dinámico de staging (arquitectura genérica)**. 
Falta construir el motor de procesamiento en segundo plano (Worker) y la API pública.

---

## 1. Setup y Base de Datos ✅ (Completado)
- Docker Compose con PostgreSQL.
- Migraciones Flyway (`V1__init.sql`).
- Entidades JPA principales (`Tenant`, `User`, `ImportJob`, `File`, `StgDropiOrder`, `Pedido`).

## 2. Autenticación y Seguridad ✅ (Completado)
- Autenticación JWT Stateless (Filtros, Provider, Endpoints).
- Login funcional en Backend (`/api/auth/login`) y Frontend (Contexto, Protección de Rutas).

## 3. Dashboard y UI Principal ✅ (Completado)
- Proyecto React + Vite con Tailwind, shadcn/ui y Lucide Icons.
- Sidebar colapsable y enrutamiento preparado para múltiples plataformas.
- Listado de Jobs de importación (CRUD básico visual) con badges de estado.
- Subida de archivos con selección de `template` (Ej. DROPI_ORDER) vinculada al Backend.

## 4. Visor Dinámico de Staging ✅ (Completado)
- Arquitectura `StagingTableReader` en Spring Boot (orquestación dinámica de consultas).
- Endpoint `/api/staging` que responde a Vistas Globales (Tenant) o Vistas por Job.
- Súper Tabla en Frontend con `@tanstack/react-table` (ocultamiento de columnas, filtros tipo Excel, ordenación sincronizada con el servidor).

## 5. Worker de Procesamiento Fila a Fila ⏳ (Pendiente)
- **Extracción:** Lector de Excel (`Apache POI`) para extraer datos del archivo guardado en el servidor.
- **Carga a Staging:** Volcado de las filas leídas del Excel hacia la tabla `stg_dropi_order` en baches.
- **Orquestación:** `JobScheduler` para tomar jobs `PENDING` atómicamente y procesarlos en segundo plano.
- **Normalización (UPSERT):** Leer la tabla de staging y hacer UPSERT hacia la tabla consolidada `pedidos`.

## 6. API Pública y API Keys ⏳ (Pendiente)
- Gestión de API Keys (Creación, Revocación, Hasheo seguro SHA-256).
- Filtro de seguridad `ApiKeyAuthFilter` para accesos programáticos externos.
- Endpoints públicos (`GET /api/v1/pedidos`) paginados y con Rate Limiting básico.

---

## Tabla de Progreso General

| Módulo / Fase | Estado | Descripción |
|---|---|---|
| **Base de Datos & Entorno** | ✅ Terminado | Docker, Flyway, Postgres, esquemas iniciales listos. |
| **Autenticación (JWT)** | ✅ Terminado | Seguridad, validación BCrypt, generación y parseo de tokens. |
| **Gestión de Archivos** | ✅ Terminado | Subida física de Excel, registro en BD y creación de Jobs. |
| **Frontend (Core & UI)** | ✅ Terminado | Estructura, Layouts, protección de rutas y vistas principales. |
| **Visor de Staging (UI)** | ✅ Terminado | TanStack Table, vistas globales e individuales 100% dinámicas. |
| **Worker: Lector de Excel** | ⏳ Pendiente | Lógica con Apache POI para poblar `stg_dropi_order`. |
| **Worker: Sincronizador** | ⏳ Pendiente | Tarea background (JobScheduler) y UPSERT final a `pedidos`. |
| **API Externa & Keys** | ⏳ Pendiente | Sistema de generación de llaves y endpoints públicos `/v1/`. |