-- ─── 004 — erpsync_params ────────────────────────────────────────────────────
-- Tabla de parámetros propia del módulo erp-sync.
-- Completamente independiente del backend principal.

CREATE TABLE IF NOT EXISTS erpsync_params (
  id          SERIAL        PRIMARY KEY,
  clave       VARCHAR(100)  NOT NULL UNIQUE,
  valor       TEXT          NOT NULL,
  descripcion TEXT          NULL,
  updated_at  TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- Parámetros iniciales del módulo
INSERT INTO erpsync_params (clave, valor, descripcion) VALUES
  ('ERPSYNC_ENABLED',          'true',          'Activa o pausa el scheduler completamente'),
  ('ERPSYNC_CRON',             '*/15 * * * *',  'Frecuencia de ejecución automática (cron expression)'),
  ('ERPSYNC_MAX_ATTEMPTS',     '3',             'Reintentos máximos antes de pasar a blocked'),
  ('ERPSYNC_RETRY_DELAY_MIN',  '10',            'Minutos de espera entre reintentos'),
  ('ERPSYNC_BATCH_SIZE',       '50',            'Registros procesados por ciclo del scheduler'),
  ('ERPSYNC_ERP_BASE_URL',     '',              'URL base de ERPNext (ej: http://192.168.1.74:9999)'),
  ('ERPSYNC_ERP_AUTH',         '',              'Header Authorization para ERPNext (Basic xxx==)'),
  ('ERPSYNC_ERP_TIMEOUT_MS',   '15000',         'Timeout en ms para llamadas HTTP a ERPNext'),
  ('ERPSYNC_LOG_PAYLOAD',      'true',          'Guarda el payload en el log (puede desactivarse en prod)'),
  ('ERPSYNC_CUSTOMER_GROUP',   'Individual',    'Valor fijo de customer_group en ERPNext para clientes'),
  ('ERPSYNC_TERRITORY',        'Colombia',      'Valor fijo de territory en ERPNext para clientes'),
  ('ERPSYNC_CUSTOMER_ID_FIELD','email_id',      'Campo de búsqueda de cliente en ERPNext: email_id o custom_external_id')
ON CONFLICT (clave) DO NOTHING;
