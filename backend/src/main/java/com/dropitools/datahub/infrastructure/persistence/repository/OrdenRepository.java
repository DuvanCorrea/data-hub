package com.dropitools.datahub.infrastructure.persistence.repository;

import com.dropitools.datahub.infrastructure.persistence.entity.OrdenEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface OrdenRepository extends JpaRepository<OrdenEntity, Long> {

    Optional<OrdenEntity> findByTenantIdAndDropiId(Long tenantId, String dropiId);

    // ── Listado con filtros opcionales (JPQL — sin cast problem) ─────────────
    @Query("""
        SELECT o FROM OrdenEntity o
        WHERE o.tenantId = :tenantId
          AND (:estatus   IS NULL OR o.estatus       = :estatus)
          AND (:ciudad    IS NULL OR o.ciudadDestino = :ciudad)
          AND (:tiendaId  IS NULL OR o.tiendaId      = :tiendaId)
          AND (:fechaDesde IS NULL OR o.fecha        >= :fechaDesde)
          AND (:fechaHasta IS NULL OR o.fecha        <= :fechaHasta)
        """)
    Page<OrdenEntity> findFiltered(Long tenantId,
                                    String estatus,
                                    String ciudad,
                                    Long tiendaId,
                                    LocalDate fechaDesde,
                                    LocalDate fechaHasta,
                                    Pageable pageable);

    // ── KPIs globales ─────────────────────────────────────────────────────────
    // CAST(x AS date) en vez de x::date para evitar conflicto con parser de params de Spring
    @Query(value = """
        SELECT COUNT(*)                                               AS total_ordenes,
               COALESCE(SUM(ganancia), 0)                            AS ganancia_total,
               COALESCE(SUM(total_orden), 0)                         AS venta_total,
               COUNT(*) FILTER (WHERE estatus = 'ENTREGADO')         AS entregadas,
               COALESCE(SUM(precio_flete), 0)                        AS flete_total,
               COALESCE(SUM(comision), 0)                            AS comision_total
        FROM ordenes
        WHERE tenant_id = :tenantId
          AND (CAST(:fechaDesde AS date) IS NULL OR fecha >= CAST(:fechaDesde AS date))
          AND (CAST(:fechaHasta AS date) IS NULL OR fecha <= CAST(:fechaHasta AS date))
        """, nativeQuery = true)
    List<Object[]> kpis(@Param("tenantId") Long tenantId,
                        @Param("fechaDesde") String fechaDesde,
                        @Param("fechaHasta") String fechaHasta);

    // ── Conteo por estatus ────────────────────────────────────────────────────
    @Query(value = """
        SELECT estatus, COUNT(*), COALESCE(SUM(total_orden), 0)
        FROM ordenes
        WHERE tenant_id = :tenantId
          AND (CAST(:fechaDesde AS date) IS NULL OR fecha >= CAST(:fechaDesde AS date))
          AND (CAST(:fechaHasta AS date) IS NULL OR fecha <= CAST(:fechaHasta AS date))
        GROUP BY estatus
        ORDER BY COUNT(*) DESC
        """, nativeQuery = true)
    List<Object[]> countByEstatus(@Param("tenantId") Long tenantId,
                                   @Param("fechaDesde") String fechaDesde,
                                   @Param("fechaHasta") String fechaHasta);

    // ── Top 15 ciudades ───────────────────────────────────────────────────────
    @Query(value = """
        SELECT ciudad_destino, COUNT(*), COALESCE(SUM(total_orden), 0)
        FROM ordenes
        WHERE tenant_id = :tenantId
          AND ciudad_destino IS NOT NULL
          AND (CAST(:fechaDesde AS date) IS NULL OR fecha >= CAST(:fechaDesde AS date))
          AND (CAST(:fechaHasta AS date) IS NULL OR fecha <= CAST(:fechaHasta AS date))
        GROUP BY ciudad_destino
        ORDER BY COUNT(*) DESC
        LIMIT 15
        """, nativeQuery = true)
    List<Object[]> topCiudades(@Param("tenantId") Long tenantId,
                                @Param("fechaDesde") String fechaDesde,
                                @Param("fechaHasta") String fechaHasta);

    // ── Evolución DIARIA ──────────────────────────────────────────────────────
    @Query(value = """
        SELECT fecha,
               COUNT(*)                      AS total,
               COALESCE(SUM(ganancia), 0)    AS ganancia_total,
               COALESCE(SUM(total_orden), 0) AS venta_total
        FROM ordenes
        WHERE tenant_id = :tenantId
          AND fecha IS NOT NULL
          AND (CAST(:fechaDesde AS date) IS NULL OR fecha >= CAST(:fechaDesde AS date))
          AND (CAST(:fechaHasta AS date) IS NULL OR fecha <= CAST(:fechaHasta AS date))
        GROUP BY fecha
        ORDER BY fecha
        """, nativeQuery = true)
    List<Object[]> evolucionDiaria(@Param("tenantId") Long tenantId,
                                    @Param("fechaDesde") String fechaDesde,
                                    @Param("fechaHasta") String fechaHasta);

    // ── Evolución mensual (fallback) ──────────────────────────────────────────
    @Query(value = """
        SELECT EXTRACT(YEAR  FROM fecha)      AS anio,
               EXTRACT(MONTH FROM fecha)      AS mes,
               COUNT(*)                       AS total,
               COALESCE(SUM(ganancia), 0)     AS ganancia_total,
               COALESCE(SUM(total_orden), 0)  AS venta_total
        FROM ordenes
        WHERE tenant_id = :tenantId
          AND fecha IS NOT NULL
          AND (CAST(:fechaDesde AS date) IS NULL OR fecha >= CAST(:fechaDesde AS date))
          AND (CAST(:fechaHasta AS date) IS NULL OR fecha <= CAST(:fechaHasta AS date))
        GROUP BY 1, 2
        ORDER BY 1, 2
        """, nativeQuery = true)
    List<Object[]> evolucionMensual(@Param("tenantId") Long tenantId,
                                     @Param("fechaDesde") String fechaDesde,
                                     @Param("fechaHasta") String fechaHasta);

    // ── Órdenes activas ("Live Operations") ──────────────────────────────────
    @Query(value = """
        SELECT o.id, o.dropi_id, o.estatus, o.transportadora,
               o.fecha, o.total_orden, o.ciudad_destino,
               CURRENT_DATE - o.fecha AS dias_activa
        FROM ordenes o
        WHERE o.tenant_id = :tenantId
          AND o.estatus NOT IN ('ENTREGADO','CANCELADO','CANCELADO CLIENTE')
          AND o.fecha IS NOT NULL
        ORDER BY o.updated_at DESC
        LIMIT 10
        """, nativeQuery = true)
    List<Object[]> ordenesActivas(@Param("tenantId") Long tenantId);
}
