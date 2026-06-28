package com.dropitools.datahub.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "orden_items")
@Getter @Setter
public class OrdenItemEntity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "orden_id", nullable = false)
    private Long ordenId;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    @Column(name = "producto_id")
    private Long productoId;

    // Identificadores raw
    @Column(name = "producto_id_dropi", length = 100)  private String productoIdDropi;
    @Column(name = "sku", length = 100)                private String sku;
    @Column(name = "variacion_id_dropi", length = 100) private String variacionIdDropi;
    @Column(name = "nombre_producto", length = 500)    private String nombreProducto;
    @Column(name = "nombre_variacion", length = 500)   private String nombreVariacion;

    // Cantidad
    @Column(name = "cantidad") private Integer cantidad;

    // Precio proveedor (perspectiva BODEGA)
    @Column(name = "precio_proveedor",             precision = 15, scale = 2) private BigDecimal precioProveedor;
    @Column(name = "precio_proveedor_x_cantidad",  precision = 15, scale = 2) private BigDecimal precioProveedorXCantidad;
    @Column(name = "porcentaje_comision_plataforma", precision = 8, scale = 4) private BigDecimal porcentajeComisionPlataforma;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() { createdAt = OffsetDateTime.now(); }
}
