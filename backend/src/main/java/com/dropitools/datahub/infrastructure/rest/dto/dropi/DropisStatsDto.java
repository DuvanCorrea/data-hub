package com.dropitools.datahub.infrastructure.rest.dto.dropi;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data @Builder
public class DropisStatsDto {

    // ── KPIs perspectiva TIENDA ───────────────────────────────────
    private Long       totalOrdenes;
    private BigDecimal ventaTotal;
    private BigDecimal gananciaTotal;
    private Long       ordenesEntregadas;
    private BigDecimal tasaEntrega;      // 0-100
    private BigDecimal fleteTotal;

    // ── KPIs perspectiva BODEGA ───────────────────────────────────
    private Long       unidadesTotal;
    private BigDecimal costoProveedorTotal;
    private Long       ordenesConItems;

    // ── Distribuciones para gráficas ─────────────────────────────
    private List<EstatusCount>  porEstatus;
    private List<CiudadCount>   topCiudades;
    private List<MesCount>      evolucion;
    private List<ProductoCount> topProductos;

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

    @Data @Builder
    public static class MesCount {
        private Integer anio;
        private Integer mes;
        private Long count;
        private BigDecimal gananciaTotal;
    }

    @Data @Builder
    public static class ProductoCount {
        private String nombre;
        private String sku;
        private Long qtyTotal;
        private Long ordenesCount;
    }
}
