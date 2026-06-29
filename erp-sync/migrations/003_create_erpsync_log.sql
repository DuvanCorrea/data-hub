-- ─── 003 — erpsync_log ────────────────────────────────────────────────────────
-- Auditoría de cada intento de sincronización.

CREATE TABLE IF NOT EXISTS erpsync_log (
  id               SERIAL        PRIMARY KEY,
  record_id        INTEGER       NOT NULL REFERENCES erpsync_incoming_records(id) ON DELETE CASCADE,

  attempt_number   INTEGER       NOT NULL,
  triggered_by     VARCHAR(50)   NOT NULL,       -- 'scheduler' | 'manual' | 'api'
  started_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
  finished_at      TIMESTAMP     NULL,
  duration_ms      INTEGER       NULL,

  -- Contexto ERP
  erp_version      VARCHAR(20)   NOT NULL,
  erp_doctype      VARCHAR(100)  NOT NULL,
  http_method      VARCHAR(10)   NULL,           -- 'GET' | 'POST' | 'PUT'
  http_url         VARCHAR(500)  NULL,
  http_status      INTEGER       NULL,

  -- Payloads (pueden desactivarse en prod via ERPSYNC_LOG_PAYLOAD)
  request_payload  JSONB         NULL,
  response_body    JSONB         NULL,

  -- Resultado
  result           VARCHAR(20)   NOT NULL,       -- 'success' | 'error' | 'skipped'
  error_code       VARCHAR(50)   NULL,
  error_message    TEXT          NULL,

  created_at       TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_record_id  ON erpsync_log(record_id);
CREATE INDEX IF NOT EXISTS idx_log_result     ON erpsync_log(result);
CREATE INDEX IF NOT EXISTS idx_log_started_at ON erpsync_log(started_at DESC);
