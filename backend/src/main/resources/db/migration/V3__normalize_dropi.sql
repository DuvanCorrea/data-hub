-- ================================================================
-- V3__normalize_dropi.sql
-- Reemplaza la tabla `pedidos` (flat) con el schema normalizado:
--   tiendas, vendedores, clientes, ordenes, productos, orden_items
-- ================================================================

-- ── Drop tabla legacy ─────────────────────────────────────────────
DROP TABLE IF EXISTS pedidos CASCADE;

-- ── tiendas ───────────────────────────────────────────────────────
-- Tienda/canal de venta (Shopify, WooCommerce, etc.)
-- El vendedor que gestiona la tienda va en la tabla vendedores.
CREATE TABLE tiendas (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT       NOT NULL REFERENCES tenants(id),
    nombre      VARCHAR(150) NOT NULL,
    tipo        VARCHAR(60),           -- SHOPIFY | WOO | MANUAL | ...
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, nombre)
);

-- ── vendedores ────────────────────────────────────────────────────
-- Vendedor asociado a una tienda
CREATE TABLE vendedores (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT       NOT NULL REFERENCES tenants(id),
    tienda_id   BIGINT       REFERENCES tiendas(id),
    nombre      VARCHAR(150) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, nombre)
);

-- ── clientes ──────────────────────────────────────────────────────
CREATE TABLE clientes (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT       NOT NULL REFERENCES tenants(id),
    nombre              VARCHAR(255),
    telefono            VARCHAR(80),
    email               VARCHAR(255),
    tipo_identificacion VARCHAR(80),
    nro_identificacion  VARCHAR(80),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
-- Upsert key: un teléfono no puede tener dos clientes en el mismo tenant
CREATE UNIQUE INDEX idx_clientes_telefono
    ON clientes(tenant_id, telefono)
    WHERE telefono IS NOT NULL AND telefono <> '';

-- ── ordenes ───────────────────────────────────────────────────────
-- Una fila por dropi_id. Ambos templates escriben aquí.
-- Perspectiva TIENDA   → total_orden, ganancia
-- Perspectiva BODEGA   → precio proveedor está en orden_items
CREATE TABLE ordenes (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL REFERENCES tenants(id),
    dropi_id        VARCHAR(80)  NOT NULL,

    -- Relaciones normalizadas
    cliente_id      BIGINT       REFERENCES clientes(id),
    tienda_id       BIGINT       REFERENCES tiendas(id),
    vendedor_id     BIGINT       REFERENCES vendedores(id),

    -- Datos básicos
    fecha           DATE,
    hora            VARCHAR(20),
    fecha_reporte   VARCHAR(50),
    estatus         VARCHAR(100),

    -- Envío
    numero_guia                 VARCHAR(150),
    tipo_envio                  VARCHAR(80),
    transportadora              VARCHAR(120),
    departamento_destino        VARCHAR(120),
    ciudad_destino              VARCHAR(120),
    direccion                   VARCHAR(500),
    codigo_postal               VARCHAR(20),

    -- Precio de venta (perspectiva TIENDA)
    total_orden                 NUMERIC(15,2),
    ganancia                    NUMERIC(15,2),
    precio_flete                NUMERIC(15,2),
    costo_devolucion_flete      NUMERIC(15,2),
    comision                    NUMERIC(15,2),

    -- Facturación — solo DROPI_ORDER
    numero_factura              VARCHAR(100),
    valor_facturado             NUMERIC(15,2),
    orden_dropshipper           VARCHAR(100),
    usuario_generacion_guia     VARCHAR(120),
    categorias                  VARCHAR(500),

    -- Refs tienda / logística
    id_orden_tienda             VARCHAR(100),
    numero_pedido_tienda        VARCHAR(100),
    tags                        VARCHAR(500),
    fecha_guia_generada         VARCHAR(50),

    -- Novedad
    novedad                     TEXT,
    fue_solucionada_novedad     VARCHAR(50),
    fecha_novedad               VARCHAR(50),
    solucion                    TEXT,
    fecha_solucion              VARCHAR(50),
    observacion                 TEXT,

    -- Último movimiento
    ultimo_movimiento           VARCHAR(255),
    concepto_ultimo_movimiento  VARCHAR(255),
    ubicacion_ultimo_movimiento VARCHAR(255),
    fecha_ultimo_movimiento     VARCHAR(50),

    -- Indemnizaciones
    contador_indemnizaciones    VARCHAR(50),
    concepto_ultima_indenmizacion VARCHAR(500),

    -- Meta
    notas                       TEXT,
    tiene_items                 BOOLEAN      NOT NULL DEFAULT FALSE,

    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    UNIQUE (tenant_id, dropi_id)
);

-- ── productos ─────────────────────────────────────────────────────
-- Catálogo de productos — solo se popula desde DOPI_ORDER_PRODUCT
CREATE TABLE productos (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         BIGINT       NOT NULL REFERENCES tenants(id),
    producto_id_dropi VARCHAR(100) NOT NULL,
    sku               VARCHAR(100),
    nombre            VARCHAR(500),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, producto_id_dropi)
);

-- ── orden_items ───────────────────────────────────────────────────
-- Líneas de producto por orden — solo desde DOPI_ORDER_PRODUCT.
-- Precio de proveedor = perspectiva BODEGA.
CREATE TABLE orden_items (
    id                              BIGSERIAL PRIMARY KEY,
    orden_id                        BIGINT       NOT NULL REFERENCES ordenes(id),
    tenant_id                       BIGINT       NOT NULL REFERENCES tenants(id),
    producto_id                     BIGINT       REFERENCES productos(id),

    -- Identificadores (raw del archivo)
    producto_id_dropi               VARCHAR(100),
    sku                             VARCHAR(100),
    variacion_id_dropi              VARCHAR(100),
    nombre_producto                 VARCHAR(500),
    nombre_variacion                VARCHAR(500),

    -- Cantidad
    cantidad                        INT,

    -- Precio de proveedor (perspectiva BODEGA)
    precio_proveedor                NUMERIC(15,2),
    precio_proveedor_x_cantidad     NUMERIC(15,2),
    porcentaje_comision_plataforma  NUMERIC(8,4),

    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
-- Evita duplicados al re-procesar: (orden, producto, variacion)
CREATE UNIQUE INDEX idx_orden_items_unique
    ON orden_items(orden_id, producto_id_dropi, COALESCE(variacion_id_dropi, ''));

-- ── Índices analíticos ────────────────────────────────────────────
CREATE INDEX idx_ordenes_tenant_estatus    ON ordenes(tenant_id, estatus);
CREATE INDEX idx_ordenes_tenant_fecha      ON ordenes(tenant_id, fecha);
CREATE INDEX idx_ordenes_tenant_ciudad     ON ordenes(tenant_id, ciudad_destino);
CREATE INDEX idx_ordenes_cliente           ON ordenes(cliente_id);
CREATE INDEX idx_ordenes_tienda            ON ordenes(tienda_id);
CREATE INDEX idx_orden_items_orden         ON orden_items(orden_id);
CREATE INDEX idx_orden_items_producto      ON orden_items(producto_id);
CREATE INDEX idx_clientes_tenant           ON clientes(tenant_id);
CREATE INDEX idx_productos_tenant          ON productos(tenant_id);
CREATE INDEX idx_tiendas_tenant            ON tiendas(tenant_id);
CREATE INDEX idx_vendedores_tienda         ON vendedores(tienda_id);
