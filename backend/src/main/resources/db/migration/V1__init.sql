-- =============================================================
-- V1__init.sql  — Esquema base del data-hub
-- Los nombres de columnas de stg_dropi_order son un CONTRATO;
-- ajustar SOLO si el Excel real del Día 1 los desmiente.
-- =============================================================

-- ── Extensiones ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- para gen_random_uuid()

-- ── Tablas ────────────────────────────────────────────────────

-- Tenants (multi-tenancy básico)
CREATE TABLE tenants (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    slug        VARCHAR(60)  NOT NULL UNIQUE,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Usuarios
CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT       NOT NULL REFERENCES tenants(id),
    username    VARCHAR(80)  NOT NULL,
    password    VARCHAR(255) NOT NULL,     -- BCrypt hash
    role        VARCHAR(20)  NOT NULL DEFAULT 'OPERATOR',  -- ADMIN | OPERATOR
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, username)
);

-- Archivos subidos
CREATE TABLE files (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL REFERENCES tenants(id),
    user_id         BIGINT       NOT NULL REFERENCES users(id),
    original_name   VARCHAR(255) NOT NULL,
    stored_path     VARCHAR(500) NOT NULL,
    sha256          VARCHAR(64)  NOT NULL,
    size_bytes      BIGINT,
    status          VARCHAR(20)  NOT NULL DEFAULT 'UPLOADED',  -- UPLOADED | PROCESSED | ERROR
    uploaded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, sha256)    -- evita resubidas duplicadas
);

-- Jobs de importación
CREATE TABLE import_jobs (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL REFERENCES tenants(id),
    file_id         BIGINT       NOT NULL REFERENCES files(id),
    template        VARCHAR(40)  NOT NULL DEFAULT 'DROPI_ORDER',
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    -- PENDING | RUNNING | COMPLETED | ERROR
    rows_total      INT,
    rows_done       INT          NOT NULL DEFAULT 0,
    error_msg       TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Staging de pedidos Dropi (contrato con el Excel real)
-- Las columnas coinciden exactamente con la cabecera real del archivo exportado.
CREATE TABLE stg_dropi_order (
    id                  BIGSERIAL PRIMARY KEY,
    import_job_id       BIGINT       NOT NULL REFERENCES import_jobs(id),
    tenant_id           BIGINT       NOT NULL REFERENCES tenants(id),
    -- ── Columnas del Excel (todas como VARCHAR) ────────────────
    fecha_de_reporte                 VARCHAR(255),
    id_dropi                         VARCHAR(255), -- Cabecera original dice 'ID', lo llamamos id_dropi
    orden_de_dropshipper             VARCHAR(255),
    hora                             VARCHAR(255),
    fecha                            VARCHAR(255),
    nombre_cliente                   VARCHAR(255),
    telefono                         VARCHAR(255),
    email                            VARCHAR(255),
    tipo_de_identificacion           VARCHAR(255),
    nro_de_identificacion            VARCHAR(255),
    numero_guia                      VARCHAR(255),
    estatus                          VARCHAR(255),
    tipo_de_envio                    VARCHAR(255),
    departamento_destino             VARCHAR(255),
    ciudad_destino                   VARCHAR(255),
    direccion                        VARCHAR(500),
    notas                            TEXT,
    transportadora                   VARCHAR(255),
    numero_de_factura                VARCHAR(255),
    valor_facturado                  VARCHAR(255),
    total_de_la_orden                VARCHAR(255),
    ganancia                         VARCHAR(255),
    precio_flete                     VARCHAR(255),
    costo_devolucion_flete           VARCHAR(255),
    comision                         VARCHAR(255),
    novedad                          TEXT,
    fue_solucionada_la_novedad       VARCHAR(255),
    hora_de_novedad                  VARCHAR(255),
    fecha_de_novedad                 VARCHAR(255),
    solucion                         TEXT,
    hora_de_solucion                 VARCHAR(255),
    fecha_de_solucion                VARCHAR(255),
    observacion                      TEXT,
    hora_de_ultimo_movimiento        VARCHAR(255),
    fecha_de_ultimo_movimiento       VARCHAR(255),
    ultimo_movimiento                VARCHAR(255),
    concepto_ultimo_movimiento       VARCHAR(255),
    ubicacion_de_ultimo_movimiento   VARCHAR(255),
    vendedor                         VARCHAR(255),
    tipo_de_tienda                   VARCHAR(255),
    tienda                           VARCHAR(255),
    id_de_orden_de_tienda            VARCHAR(255),
    numero_de_pedido_de_tienda       VARCHAR(255),
    tags                             VARCHAR(500),
    fecha_generacion_de_guia         VARCHAR(255),
    usuario_generacion_de_guia       VARCHAR(255),
    codigo_postal                    VARCHAR(255),
    contador_de_indemnizaciones      VARCHAR(255),
    concepto_ultima_indenmizacion    VARCHAR(255),
    categorias                       VARCHAR(500),
    -- ── Meta de procesamiento ─────────────────────────────────
    processing_status   VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    -- PENDING | PROCESSED | ERROR
    error_detail        TEXT,
    processed_at        TIMESTAMPTZ,
    row_number          INT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Pedidos normalizados (destino final del UPSERT)
CREATE TABLE pedidos (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT           NOT NULL REFERENCES tenants(id),
    dropi_id        VARCHAR(80)      NOT NULL,  -- Mapeado desde el campo 'ID' del excel
    fecha           DATE,                       -- Mapeado desde 'FECHA'
    nombre_cliente  VARCHAR(255),
    telefono        VARCHAR(80),
    email           VARCHAR(255),
    numero_guia     VARCHAR(120),
    estatus         VARCHAR(80),
    tipo_de_envio   VARCHAR(80),
    departamento    VARCHAR(120),
    ciudad          VARCHAR(120),
    direccion       VARCHAR(500),
    notas           TEXT,
    transportadora  VARCHAR(120),
    total_orden     NUMERIC(15, 2),             -- Parseado, manejando la coma
    ganancia        NUMERIC(15, 2),             -- Parseado, manejando la coma
    precio_flete    NUMERIC(15, 2),
    vendedor        VARCHAR(120),
    tienda          VARCHAR(120),               -- 'TIENDA'
    tags            VARCHAR(500),
    categorias      VARCHAR(500),
    novedad         TEXT,
    ultimo_movimiento VARCHAR(255),
    created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, dropi_id)     -- clave para el UPSERT
);

-- API Keys para clientes externos
CREATE TABLE api_keys (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL REFERENCES tenants(id),
    name            VARCHAR(120) NOT NULL,
    key_hash        VARCHAR(64)  NOT NULL UNIQUE,   -- SHA-256 del valor real
    permissions     VARCHAR(20)  NOT NULL DEFAULT 'READ',
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    expires_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX idx_import_jobs_tenant_status  ON import_jobs(tenant_id, status);
CREATE INDEX idx_import_jobs_updated_at     ON import_jobs(updated_at);
CREATE INDEX idx_stg_processing_status      ON stg_dropi_order(import_job_id, processing_status);
CREATE INDEX idx_pedidos_tenant_dropi       ON pedidos(tenant_id, dropi_id);
CREATE INDEX idx_pedidos_tenant_estatus     ON pedidos(tenant_id, estatus);
CREATE INDEX idx_pedidos_fecha              ON pedidos(tenant_id, fecha);
CREATE INDEX idx_api_keys_hash              ON api_keys(key_hash) WHERE is_active = TRUE;

-- ── Datos semilla ─────────────────────────────────────────────
-- Password: "admin123" hasheado con BCrypt (costo 12)
INSERT INTO tenants (name, slug) VALUES ('Dropi Tools', 'dropi-tools');

INSERT INTO users (tenant_id, username, password, role)
VALUES (
    1,
    'admin',
    '$2b$12$9JsRTmOUkTxm1zxHIvwNxOvzCz8LcCodqPnqAtAgYgIa/YAumSxJe',
    'ADMIN'
);
