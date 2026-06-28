package com.dropitools.datahub.infrastructure.rest.dto.dropi;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/** Fila en el listado de órdenes (sin items, optimizado para tabla) */
@Data @Builder
public class OrdenListDto {
    private Long        id;
    private String      dropiId;
    private LocalDate   fecha;
    private String      estatus;
    private String      nombreCliente;
    private String      telefono;
    private String      ciudadDestino;
    private String      departamentoDestino;
    private String      transportadora;
    private String      numeroGuia;
    private BigDecimal  totalOrden;
    private BigDecimal  ganancia;
    private BigDecimal  precioFlete;
    private String      tienda;
    private String      vendedor;
    private Boolean     tieneItems;
    private OffsetDateTime createdAt;
}
