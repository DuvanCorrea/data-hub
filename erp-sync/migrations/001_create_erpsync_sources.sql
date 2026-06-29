-- ─── 001 — erpsync_sources ────────────────────────────────────────────────────
-- Fuentes registradas que pueden enviar registros al módulo de sync.

CREATE TABLE IF NOT EXISTS erpsync_sources (
  id           SERIAL       PRIMARY KEY,
  source_name  VARCHAR(50)  NOT NULL UNIQUE,
  description  TEXT         NULL,
  erp_version  VARCHAR(20)  NOT NULL DEFAULT 'v16',
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Fuentes iniciales
INSERT INTO erpsync_sources (source_name, description, erp_version, is_active)
VALUES
  ('DROPI',  'Integración con plataforma DROPI', 'v16', TRUE),
  ('MANUAL', 'Ingreso manual desde panel admin',  'v16', TRUE)
ON CONFLICT (source_name) DO NOTHING;
