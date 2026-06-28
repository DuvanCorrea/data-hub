package com.dropitools.datahub.infrastructure.rest.dto.dropi;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

@Data @Builder
public class OrdenDetalleDto {
    private Long        id;
    private String      dropiId;
    private LocalDate   fecha;
    private String      hora;
    private String      fechaReporte;
    private String      estatus;

    // Envío
    private String     numeroGuia;
    private String     tipoEnvio;
    private String     transportadora;
    private String     departamentoDestino;
    private String     ciudadDestino;
    private String     direccion;
    private String     codigoPostal;

    // Precios venta (perspectiva TIENDA)
    private BigDecimal totalOrden;
    private BigDecimal ganancia;
    private BigDecimal precioFlete;
    private BigDecimal costoDevolucionFlete;
    private BigDecimal comision;

    // Facturación — solo DROPI_ORDER
    private String     numeroFactura;
    private BigDecimal valorFacturado;
    private String     ordenDropshipper;

    // Tienda
    private String     tienda;
    private String     tipoTienda;
    private String     vendedor;
    private String     idOrdenTienda;
    private String     numeroPedidoTienda;
    private String     tags;
    private String     categorias;
    private String     fechaGuiaGenerada;

    // Novedad / movimiento
    private String     novedad;
    private String     fueSolucionadaNovedad;
    private String     solucion;
    private String     observacion;
    private String     ultimoMovimiento;
    private String     conceptoUltimoMovimiento;
    private String     ubicacionUltimoMovimiento;
    private String     fechaUltimoMovimiento;
    private String     contadorIndemnizaciones;
    private String     conceptoUltimaIndenmizacion;

    // Relacionados
    private ClienteDto           cliente;
    private List<OrdenItemDto>   items;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
