package com.dropitools.datahub.infrastructure.persistence.repository;

import com.dropitools.datahub.infrastructure.persistence.entity.ProductoEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ProductoRepository extends JpaRepository<ProductoEntity, Long> {

    Optional<ProductoEntity> findByTenantIdAndProductoIdDropi(Long tenantId, String productoIdDropi);

    Page<ProductoEntity> findByTenantId(Long tenantId, Pageable pageable);

    // Top productos por unidades vendidas con filtro de fecha
    @Query(value = """
        SELECT p.nombre, p.sku, p.producto_id_dropi,
               COALESCE(SUM(oi.cantidad), 0)  AS qty_total,
               COUNT(DISTINCT oi.orden_id)    AS ordenes_count
        FROM productos p
        LEFT JOIN orden_items oi ON oi.producto_id = p.id
        LEFT JOIN ordenes o ON o.id = oi.orden_id
        WHERE p.tenant_id = :tenantId
          AND (CAST(:fechaDesde AS date) IS NULL OR o.fecha >= CAST(:fechaDesde AS date))
          AND (CAST(:fechaHasta AS date) IS NULL OR o.fecha <= CAST(:fechaHasta AS date))
        GROUP BY p.id, p.nombre, p.sku, p.producto_id_dropi
        ORDER BY qty_total DESC
        LIMIT 10
        """, nativeQuery = true)
    java.util.List<Object[]> topProductos(@Param("tenantId") Long tenantId,
                                          @Param("fechaDesde") String fechaDesde,
                                          @Param("fechaHasta") String fechaHasta);
}
