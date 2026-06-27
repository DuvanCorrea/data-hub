package com.dropitools.datahub.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * Entidad de dominio: Pedido normalizado (destino final del UPSERT).
 * Esta clase vive en el dominio y NO depende de JPA ni de ningún framework.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Pedido {

    private Long id;
    private Long tenantId;
    private String dropiId;
    private LocalDate fecha;
    private String nombreCliente;
    private String telefono;
    private String email;
    private String numeroGuia;
    private String estatus;
    private String tipoEnvio;
    private String departamento;
    private String ciudad;
    private String direccion;
    private String notas;
    private String transportadora;
    private java.math.BigDecimal totalOrden;
    private java.math.BigDecimal ganancia;
    private java.math.BigDecimal precioFlete;
    private String vendedor;
    private String tienda;
    private String tags;
    private String categorias;
    private String novedad;
    private String ultimoMovimiento;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
