-- ================================================================
-- V5__parametros.sql
-- Tabla de parámetros de configuración global del sistema.
-- Los parámetros se siembran aquí; los usuarios ADMIN pueden
-- modificar el campo `valor` desde la UI de Ajustes.
-- ================================================================

CREATE TABLE parametros (
    id              BIGSERIAL PRIMARY KEY,
    aplicacion      VARCHAR(40)  NOT NULL,           -- SYSTEM | DROPI | SHOPIFY | ...
    clave           VARCHAR(100) NOT NULL UNIQUE,     -- identificador programático
    etiqueta        VARCHAR(255) NOT NULL,            -- label legible para la UI
    descripcion     TEXT,                            -- ayuda contextual para el usuario
    tipo_dato       VARCHAR(20)  NOT NULL,           -- STRING | NUMBER | BOOLEAN | SELECT
    valor           TEXT         NOT NULL,           -- valor actual (siempre como texto)
    valor_defecto   TEXT         NOT NULL,           -- usado por el botón "Resetear"
    opciones        JSONB,                           -- solo tipo SELECT: [{valor,etiqueta}]
    es_editable     BOOLEAN      NOT NULL DEFAULT TRUE,
    orden           INT          NOT NULL DEFAULT 0, -- orden de aparición dentro del grupo
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by      BIGINT       REFERENCES users(id)
);

-- ── Índice para lectura por aplicación ───────────────────────────
CREATE INDEX idx_parametros_aplicacion ON parametros(aplicacion);

-- ================================================================
-- SEED — parámetros iniciales
-- ================================================================

INSERT INTO parametros (aplicacion, clave, etiqueta, descripcion, tipo_dato,
                         valor, valor_defecto, opciones, orden)
VALUES

-- ── SYSTEM ────────────────────────────────────────────────────────
(
  'SYSTEM', 'IMPORT_BATCH_SIZE',
  'Tamaño de lote de procesamiento',
  'Cantidad de registros que se normalizan por lote al procesar un archivo importado. '
  'Con 0 se procesan todos los registros de una sola vez sin dividir en lotes.',
  'NUMBER', '0', '0', NULL, 10
),
(
  'SYSTEM', 'IMPORT_MAX_FILE_MB',
  'Tamaño máximo de archivo (MB)',
  'Límite en megabytes para los archivos que se pueden subir. '
  'Si el archivo supera este tamaño, la subida es rechazada con error 400.',
  'NUMBER', '50', '50', NULL, 20
),
(
  'SYSTEM', 'JOBS_ORPHAN_TIMEOUT_MIN',
  'Tiempo de expiración de job huérfano (minutos)',
  'Minutos que puede estar un job en estado RUNNING sin actividad antes de '
  'ser considerado huérfano y resetear su estado a PENDING para reintentarlo.',
  'NUMBER', '10', '10', NULL, 30
),
(
  'SYSTEM', 'EXPORT_MAX_ROWS',
  'Límite de filas en exportación completa',
  'Máximo de registros permitidos al usar la opción "Exportar todo". '
  'Previene problemas de memoria con tablas muy grandes.',
  'NUMBER', '10000', '10000', NULL, 40
),

-- ── DROPI ─────────────────────────────────────────────────────────
(
  'DROPI', 'DASHBOARD_RANGO_DIAS',
  'Rango por defecto del dashboard (días)',
  'Período de fechas que se carga al abrir el dashboard de Dropi. '
  'Se puede cambiar manualmente con el selector de fechas.',
  'SELECT', '7', '7',
  '[{"valor":"1","etiqueta":"Hoy"},{"valor":"7","etiqueta":"Últimos 7 días"},{"valor":"30","etiqueta":"Último mes"},{"valor":"365","etiqueta":"Último año"}]'::jsonb,
  10
),
(
  'DROPI', 'DROPI_MONEDA',
  'Moneda de visualización',
  'Moneda utilizada para mostrar los valores monetarios en toda la sección Dropi.',
  'SELECT', 'COP', 'COP',
  '[{"valor":"COP","etiqueta":"COP — Peso colombiano"},{"valor":"USD","etiqueta":"USD — Dólar"},{"valor":"EUR","etiqueta":"EUR — Euro"}]'::jsonb,
  20
);
