package com.dropitools.datahub.infrastructure.persistence.repository;

import com.dropitools.datahub.infrastructure.persistence.entity.OrdenEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface OrdenRepository extends JpaRepository<OrdenEntity, Long> {

    Optional<OrdenEntity> findByTenantIdAndDropiId(Long tenantId, String dropiId);

    // ── Listado con filtros opcionales ────────────────────────────────────────
    @Query("""
        SELECT o FROM OrdenEntity o
        WHERE o.tenantId = :tenantId
          AND (:estatus   IS NULL OR o.estatus         = :estatus)
          AND (:ciudad    IS NULL OR o.ciudadDestino   = :ciudad)
          AND (:tiendaId  IS NULL OR o.tiendaId        = :tiendaId)
          AND (:fechaDesde IS NULL OR o.fecha          >= :fechaDesde)
          AND (:fechaHasta IS NULL OR o.fecha          <= :fechaHasta)
        """)
    Page<OrdenEntity> findFiltered(Long tenantId,
                                    String estatus,
                                    String ciudad,
                                    Long tiendaId,
                                    LocalDate fechaDesde,
                                    LocalDate fechaHasta,
                                    Pageable pageable);

    // ── Stats: conteo por estatus ─────────────────────────────────────────────
    @Query("""
        SELECT o.estatus, COUNT(o), COALESCE(SUM(o.totalOrden), 0)
        FROM OrdenEntity o
        WHERE o.tenantId = :tenantId
        GROUP BY o.estatus
        ORDER BY COUNT(o) DESC
        """)
    List<Object[]> countByEstatus(Long tenantId);

    // ── Stats: top 15 ciudades ────────────────────────────────────────────────
    @Query("""
        SELECT o.ciudadDestino, COUNT(o), COALESCE(SUM(o.totalOrden), 0)
        FROM OrdenEntity o
        WHERE o.tenantId = :tenantId
          AND o.ciudadDestino IS NOT NULL
        GROUP BY o.ciudadDestino
        ORDER BY COUNT(o) DESC
        LIMIT 15
        """)
    List<Object[]> topCiudades(Long tenantId);

    // ── Stats: evolución mensual ──────────────────────────────────────────────
    @Query(value = """
        SELECT EXTRACT(YEAR FROM fecha)::int   AS anio,
               EXTRACT(MONTH FROM fecha)::int  AS mes,
               COUNT(*)                        AS total,
               COALESCE(SUM(ganancia), 0)      AS ganancia_total
        FROM ordenes
        WHERE tenant_id = :tenantId
          AND fecha IS NOT NULL
        GROUP BY 1, 2
        ORDER BY 1, 2
        """, nativeQuery = true)
    List<Object[]> evolucionMensual(Long tenantId);

    // ── Stats: KPIs globales ──────────────────────────────────────────────────
    @Query(value = """
        SELECT COUNT(*)                                           AS total_ordenes,
               COALESCE(SUM(ganancia), 0)                        AS ganancia_total,
               COALESCE(SUM(total_orden), 0)                     AS venta_total,
               COUNT(*) FILTER (WHERE estatus = 'ENTREGADO')     AS entregadas,
               COALESCE(SUM(precio_flete), 0)                    AS flete_total
        FROM ordenes
        WHERE tenant_id = :tenantId
        """, nativeQuery = true)
    List<Object[]> kpis(Long tenantId);
}
