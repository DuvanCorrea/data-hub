-- ================================================================
-- V4__add_producto_variaciones.sql
-- Tabla de variaciones por producto (normalización de orden_items).
-- Una variación = una combinación (variacion_id_dropi, nombre_variacion)
-- observada al menos una vez para ese producto.
-- ================================================================

CREATE TABLE producto_variaciones (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT       NOT NULL REFERENCES tenants(id),
    producto_id         BIGINT       NOT NULL REFERENCES productos(id),
    variacion_id_dropi  VARCHAR(100),
    nombre_variacion    VARCHAR(500),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Evitar duplicados: misma variación del mismo producto
CREATE UNIQUE INDEX idx_producto_variacion_unique
    ON producto_variaciones(
        tenant_id,
        producto_id,
        COALESCE(variacion_id_dropi, ''),
        COALESCE(nombre_variacion, '')
    );

CREATE INDEX idx_producto_variaciones_producto ON producto_variaciones(producto_id);
