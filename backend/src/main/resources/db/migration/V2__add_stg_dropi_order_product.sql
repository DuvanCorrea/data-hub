-- =============================================================
-- V2__add_stg_dropi_order_product.sql
-- Tabla staging para la plantilla DOPI_ORDER_PRODUCT.
-- Cubre el reporte "Órdenes por Producto" de Dropi, que incluye
-- un renglón por producto dentro de cada orden.
-- Diferencias vs stg_dropi_order:
--   + 9 columnas de producto: sku, variacion_id, producto_id,
--     producto, variacion, cantidad, precio_proveedor,
--     precio_proveedor_x_cantidad, porcentaje_comision_plataforma
--   - Sin: orden_de_dropshipper, numero_de_factura, valor_facturado,
--          usuario_generacion_de_guia, codigo_postal, categorias
-- =============================================================

CREATE TABLE stg_dropi_order_product (
    id                  BIGSERIAL PRIMARY KEY,
    import_job_id       BIGINT       NOT NULL REFERENCES import_jobs(id),
    tenant_id           BIGINT       NOT NULL REFERENCES tenants(id),

    -- ── Columnas comunes del Excel (todas VARCHAR) ─────────────
    fecha_de_reporte                 VARCHAR(255),
    id_dropi                         VARCHAR(255),   -- Cabecera original: 'ID'
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
    total_de_la_orden                VARCHAR(255),
    ganancia                         VARCHAR(255),
    precio_flete                     VARCHAR(255),
    costo_devolucion_flete           VARCHAR(255),
    comision                         VARCHAR(255),

    -- ── Columnas exclusivas de esta plantilla (producto) ───────
    porcentaje_comision_plataforma   VARCHAR(255),   -- '% COMISION DE LA PLATAFORMMA'
    precio_proveedor                 VARCHAR(255),
    precio_proveedor_x_cantidad      VARCHAR(255),
    producto_id                      VARCHAR(255),
    sku                              VARCHAR(255),
    variacion_id                     VARCHAR(255),
    producto                         VARCHAR(500),
    variacion                        VARCHAR(500),
    cantidad                         VARCHAR(255),

    -- ── Columnas de novedad / movimiento (comunes) ─────────────
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

    -- ── Columnas de tienda / logística ─────────────────────────
    vendedor                         VARCHAR(255),
    tipo_de_tienda                   VARCHAR(255),
    tienda                           VARCHAR(255),
    id_de_orden_de_tienda            VARCHAR(255),
    numero_de_pedido_de_tienda       VARCHAR(255),
    tags                             VARCHAR(500),
    fecha_guia_generada              VARCHAR(255),   -- En esta plantilla: 'FECHA GUIA GENERADA'
    contador_de_indemnizaciones      VARCHAR(255),
    concepto_ultima_indenmizacion    VARCHAR(255),

    -- ── Meta de procesamiento ─────────────────────────────────
    processing_status   VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    -- PENDING | PROCESSED | ERROR
    error_detail        TEXT,
    processed_at        TIMESTAMPTZ,
    row_number          INT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índice crítico para el batch de Phase B (leer PENDING de un job)
CREATE INDEX idx_stg_order_product_processing
    ON stg_dropi_order_product(import_job_id, processing_status);
