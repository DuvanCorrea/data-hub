-- ─── 002 — erpsync_incoming_records ───────────────────────────────────────────
-- Cola de entrada y fuente de verdad del estado de sincronización.

CREATE TABLE IF NOT EXISTS erpsync_incoming_records (
  id               SERIAL        PRIMARY KEY,

  -- Identificación
  source_name      VARCHAR(50)   NOT NULL REFERENCES erpsync_sources(source_name),
  entity_type      VARCHAR(50)   NOT NULL,       -- 'customer' | 'item' | 'sales_order'
  external_id      VARCHAR(200)  NOT NULL,       -- ID del registro en el sistema de origen
  erp_doctype      VARCHAR(100)  NOT NULL,       -- 'Customer' | 'Item' | 'Sales Order'

  -- Payload estándar enviado por el sistema externo
  payload          JSONB         NOT NULL,

  -- Estado
  sync_status      VARCHAR(30)   NOT NULL DEFAULT 'pending',
  -- pending | processing | synced | error | blocked | skipped

  -- Resultado en ERPNext
  erp_record_id    VARCHAR(100)  NULL,
  erp_method       VARCHAR(10)   NULL,           -- 'POST' | 'PUT'

  -- Control de reintentos
  attempts         INTEGER       NOT NULL DEFAULT 0,
  max_attempts     INTEGER       NOT NULL DEFAULT 3,
  next_attempt_at  TIMESTAMP     NULL,
  last_attempt_at  TIMESTAMP     NULL,

  -- Último error
  last_error_code  VARCHAR(50)   NULL,
  last_error_msg   TEXT          NULL,

  -- Metadatos
  triggered_by     VARCHAR(50)   NOT NULL DEFAULT 'api',
  created_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP     NOT NULL DEFAULT NOW(),

  -- Un registro único por fuente + tipo + id externo
  UNIQUE (source_name, entity_type, external_id)
);

CREATE INDEX IF NOT EXISTS idx_incoming_sync_status  ON erpsync_incoming_records(sync_status);
CREATE INDEX IF NOT EXISTS idx_incoming_source        ON erpsync_incoming_records(source_name);
CREATE INDEX IF NOT EXISTS idx_incoming_entity_type   ON erpsync_incoming_records(entity_type);
CREATE INDEX IF NOT EXISTS idx_incoming_next_attempt  ON erpsync_incoming_records(next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_incoming_erp_record    ON erpsync_incoming_records(erp_record_id);
CREATE INDEX IF NOT EXISTS idx_incoming_created_at    ON erpsync_incoming_records(created_at DESC);
