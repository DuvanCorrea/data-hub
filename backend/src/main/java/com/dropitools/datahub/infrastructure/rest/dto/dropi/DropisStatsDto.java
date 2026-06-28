package com.dropitools.datahub.infrastructure.rest.dto.dropi;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data @Builder
public class DropisStatsDto {

    // ── KPIs perspectiva TIENDA ───────────────────────────────────────────
    private Long       totalOrdenes;
    private BigDecimal ventaTotal;
    private BigDecimal gananciaTotal;
    private Long       ordenesEntregadas;
    private BigDecimal tasaEntrega;          // 0-100
    private BigDecimal fleteTotal;
    private BigDecimal comisionTotal;

    // ── KPIs perspectiva BODEGA ───────────────────────────────────────────
    private Long       unidadesTotal;
    private BigDecimal costoProveedorTotal;
    private Long       ordenesConItems;

    // ── Tendencia vs. período anterior (% cambio) ─────────────────────────
    private BigDecimal pctVenta;
    private BigDecimal pctGanancia;
    private BigDecimal pctOrdenes;
    private BigDecimal pctCostoProveedor;
    private BigDecimal margenNeto;           // ganancia / venta * 100

    // ── Distribuciones para gráficas ─────────────────────────────────────
    private List<EstatusCount>  porEstatus;
    private List<CiudadCount>   topCiudades;
    private List<DiaCount>      evolucionDiaria;
    private List<ProductoCount> topProductos;
    private List<OrdenActivaItem> ordenesActivas;

    // ── Inner DTOs ────────────────────────────────────────────────────────

    @Data @Builder
    public static class EstatusCount {
        private String estatus;
        private Long count;
        private BigDecimal montoTotal;
    }

    @Data @Builder
    public static class CiudadCount {
        private String ciudad;
        private Long count;
        private BigDecimal montoTotal;
    }

    /** Un punto en la gráfica diaria de evolución financiera */
    @Data @Builder
    public static class DiaCount {
        private String     fecha;        // ISO: "2026-01-15"
        private Long       count;
        private BigDecimal gananciaTotal;
        private BigDecimal ventaTotal;
    }

    @Data @Builder
    public static class ProductoCount {
        private String nombre;
        private String sku;
        private Long qtyTotal;
        private Long ordenesCount;
    }

    /** Orden activa para la tabla "Live Operations" */
    @Data @Builder
    public static class OrdenActivaItem {
        private Long       id;
        private String     dropiId;
        private String     estatus;
        private String     transportadora;
        private String     fecha;
        private BigDecimal totalOrden;
        private String     ciudadDestino;
        private Integer    diasActiva;
    }
}
