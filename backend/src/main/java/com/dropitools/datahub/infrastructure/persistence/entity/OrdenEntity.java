package com.dropitools.datahub.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "ordenes")
@Getter @Setter
public class OrdenEntity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    @Column(name = "dropi_id", nullable = false, length = 80)
    private String dropiId;

    // Relaciones normalizadas (IDs, sin lazy loading innecesario)
    @Column(name = "cliente_id")  private Long clienteId;
    @Column(name = "tienda_id")   private Long tiendaId;
    @Column(name = "vendedor_id") private Long vendedorId;

    // Datos básicos
    @Column(name = "fecha")          private LocalDate fecha;
    @Column(name = "hora", length = 20)        private String hora;
    @Column(name = "fecha_reporte", length = 50) private String fechaReporte;
    @Column(name = "estatus", length = 100)    private String estatus;

    // Envío
    @Column(name = "numero_guia", length = 150)          private String numeroGuia;
    @Column(name = "tipo_envio", length = 80)            private String tipoEnvio;
    @Column(name = "transportadora", length = 120)       private String transportadora;
    @Column(name = "departamento_destino", length = 120) private String departamentoDestino;
    @Column(name = "ciudad_destino", length = 120)       private String ciudadDestino;
    @Column(name = "direccion", length = 500)            private String direccion;
    @Column(name = "codigo_postal", length = 20)         private String codigoPostal;

    // Precio de venta (perspectiva TIENDA)
    @Column(name = "total_orden",            precision = 15, scale = 2) private BigDecimal totalOrden;
    @Column(name = "ganancia",               precision = 15, scale = 2) private BigDecimal ganancia;
    @Column(name = "precio_flete",           precision = 15, scale = 2) private BigDecimal precioFlete;
    @Column(name = "costo_devolucion_flete", precision = 15, scale = 2) private BigDecimal costoDevolucionFlete;
    @Column(name = "comision",               precision = 15, scale = 2) private BigDecimal comision;

    // Facturación — solo DROPI_ORDER
    @Column(name = "numero_factura", length = 100)         private String numeroFactura;
    @Column(name = "valor_facturado", precision = 15, scale = 2) private BigDecimal valorFacturado;
    @Column(name = "orden_dropshipper", length = 100)      private String ordenDropshipper;
    @Column(name = "usuario_generacion_guia", length = 120) private String usuarioGeneracionGuia;
    @Column(name = "categorias", length = 500)             private String categorias;

    // Refs tienda / logística
    @Column(name = "id_orden_tienda", length = 100)       private String idOrdenTienda;
    @Column(name = "numero_pedido_tienda", length = 100)  private String numeroPedidoTienda;
    @Column(name = "tags", length = 500)                  private String tags;
    @Column(name = "fecha_guia_generada", length = 50)    private String fechaGuiaGenerada;

    // Novedad
    @Column(name = "novedad", columnDefinition = "TEXT")    private String novedad;
    @Column(name = "fue_solucionada_novedad", length = 50)  private String fueSolucionadaNovedad;
    @Column(name = "fecha_novedad", length = 50)            private String fechaNovedad;
    @Column(name = "solucion", columnDefinition = "TEXT")   private String solucion;
    @Column(name = "fecha_solucion", length = 50)           private String fechaSolucion;
    @Column(name = "observacion", columnDefinition = "TEXT") private String observacion;

    // Último movimiento
    @Column(name = "ultimo_movimiento")           private String ultimoMovimiento;
    @Column(name = "concepto_ultimo_movimiento")  private String conceptoUltimoMovimiento;
    @Column(name = "ubicacion_ultimo_movimiento") private String ubicacionUltimoMovimiento;
    @Column(name = "fecha_ultimo_movimiento", length = 50) private String fechaUltimoMovimiento;

    // Indemnizaciones
    @Column(name = "contador_indemnizaciones", length = 50)      private String contadorIndemnizaciones;
    @Column(name = "concepto_ultima_indenmizacion", length = 500) private String conceptoUltimaIndenmizacion;

    // Meta
    @Column(name = "notas", columnDefinition = "TEXT") private String notas;
    @Column(name = "tiene_items", nullable = false)    private Boolean tieneItems = false;

    @Column(name = "created_at", nullable = false, updatable = false) private OffsetDateTime createdAt;
    @Column(name = "updated_at", nullable = false)                    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() { createdAt = updatedAt = OffsetDateTime.now(); }

    @PreUpdate
    protected void onUpdate() { updatedAt = OffsetDateTime.now(); }
}
