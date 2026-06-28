package com.dropitools.datahub.infrastructure.rest.dto.dropi;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Data @Builder
public class OrdenItemDto {
    private Long       id;
    private String     productoIdDropi;
    private String     sku;
    private String     variacionIdDropi;
    private String     nombreProducto;
    private String     nombreVariacion;
    private Integer    cantidad;
    // Perspectiva BODEGA
    private BigDecimal precioProveedor;
    private BigDecimal precioProveedorXCantidad;
    private BigDecimal porcentajeComisionPlataforma;
    private OffsetDateTime createdAt;
}
