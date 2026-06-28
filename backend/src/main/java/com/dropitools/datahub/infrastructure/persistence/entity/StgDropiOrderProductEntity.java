package com.dropitools.datahub.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Entidad JPA para la tabla stg_dropi_order_product.
 * Almacena las filas crudas del reporte "Órdenes por Producto" de Dropi.
 * Cada fila representa un (orden × producto) antes de cualquier transformación.
 */
@Entity
@Table(name = "stg_dropi_order_product")
@Getter
@Setter
public class StgDropiOrderProductEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "import_job_id", nullable = false)
    private Long importJobId;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    // ── Columnas comunes del Excel ─────────────────────────────────────────
    @Column(name = "fecha_de_reporte")                 private String fechaDeReporte;
    @Column(name = "id_dropi")                         private String idDropi;
    @Column(name = "hora")                             private String hora;
    @Column(name = "fecha")                            private String fecha;
    @Column(name = "nombre_cliente")                   private String nombreCliente;
    @Column(name = "telefono")                         private String telefono;
    @Column(name = "email")                            private String email;
    @Column(name = "tipo_de_identificacion")           private String tipoDeIdentificacion;
    @Column(name = "nro_de_identificacion")            private String nroDeIdentificacion;
    @Column(name = "numero_guia")                      private String numeroGuia;
    @Column(name = "estatus")                          private String estatus;
    @Column(name = "tipo_de_envio")                    private String tipoDeEnvio;
    @Column(name = "departamento_destino")             private String departamentoDestino;
    @Column(name = "ciudad_destino")                   private String ciudadDestino;
    @Column(name = "direccion", columnDefinition = "VARCHAR(500)")  private String direccion;
    @Column(name = "notas", columnDefinition = "TEXT")              private String notas;
    @Column(name = "transportadora")                   private String transportadora;
    @Column(name = "total_de_la_orden")                private String totalDeLaOrden;
    @Column(name = "ganancia")                         private String ganancia;
    @Column(name = "precio_flete")                     private String precioFlete;
    @Column(name = "costo_devolucion_flete")           private String costoDevolucionFlete;
    @Column(name = "comision")                         private String comision;

    // ── Columnas exclusivas de producto ───────────────────────────────────
    @Column(name = "porcentaje_comision_plataforma")   private String porcentajeComisionPlataforma;
    @Column(name = "precio_proveedor")                 private String precioProveedor;
    @Column(name = "precio_proveedor_x_cantidad")      private String precioProveedorXCantidad;
    @Column(name = "producto_id")                      private String productoId;
    @Column(name = "sku")                              private String sku;
    @Column(name = "variacion_id")                     private String variacionId;
    @Column(name = "producto", columnDefinition = "VARCHAR(500)")   private String producto;
    @Column(name = "variacion", columnDefinition = "VARCHAR(500)")  private String variacion;
    @Column(name = "cantidad")                         private String cantidad;

    // ── Novedad / movimientos ─────────────────────────────────────────────
    @Column(name = "novedad", columnDefinition = "TEXT")            private String novedad;
    @Column(name = "fue_solucionada_la_novedad")       private String fueSolucionadaLaNovedad;
    @Column(name = "hora_de_novedad")                  private String horaDeNovedad;
    @Column(name = "fecha_de_novedad")                 private String fechaDeNovedad;
    @Column(name = "solucion", columnDefinition = "TEXT")           private String solucion;
    @Column(name = "hora_de_solucion")                 private String horaDeSolucion;
    @Column(name = "fecha_de_solucion")                private String fechaDeSolucion;
    @Column(name = "observacion", columnDefinition = "TEXT")        private String observacion;
    @Column(name = "hora_de_ultimo_movimiento")        private String horaDeUltimoMovimiento;
    @Column(name = "fecha_de_ultimo_movimiento")       private String fechaDeUltimoMovimiento;
    @Column(name = "ultimo_movimiento")                private String ultimoMovimiento;
    @Column(name = "concepto_ultimo_movimiento")       private String conceptoUltimoMovimiento;
    @Column(name = "ubicacion_de_ultimo_movimiento")   private String ubicacionDeUltimoMovimiento;

    // ── Tienda / logística ────────────────────────────────────────────────
    @Column(name = "vendedor")                         private String vendedor;
    @Column(name = "tipo_de_tienda")                   private String tipoDeTienda;
    @Column(name = "tienda")                           private String tienda;
    @Column(name = "id_de_orden_de_tienda")            private String idDeOrdenDeTienda;
    @Column(name = "numero_de_pedido_de_tienda")       private String numeroDePedidoDeTienda;
    @Column(name = "tags", columnDefinition = "VARCHAR(500)")       private String tags;
    @Column(name = "fecha_guia_generada")              private String fechaGuiaGenerada;
    @Column(name = "contador_de_indemnizaciones")      private String contadorDeIndemnizaciones;
    @Column(name = "concepto_ultima_indenmizacion")    private String conceptoUltimaIndenmizacion;

    // ── Meta de procesamiento ─────────────────────────────────────────────
    @Column(name = "processing_status", nullable = false, length = 20)
    private String processingStatus = "PENDING";

    @Column(name = "error_detail", columnDefinition = "TEXT")
    private String errorDetail;

    @Column(name = "processed_at")
    private OffsetDateTime processedAt;

    @Column(name = "row_number")
    private Integer rowNumber;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
    }
}
