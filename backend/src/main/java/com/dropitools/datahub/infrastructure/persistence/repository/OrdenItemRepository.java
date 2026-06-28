package com.dropitools.datahub.infrastructure.persistence.repository;

import com.dropitools.datahub.infrastructure.persistence.entity.OrdenItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface OrdenItemRepository extends JpaRepository<OrdenItemEntity, Long> {

    List<OrdenItemEntity> findByOrdenId(Long ordenId);

    @Query("""
        SELECT oi FROM OrdenItemEntity oi
        WHERE oi.ordenId = :ordenId
          AND oi.productoIdDropi = :productoIdDropi
          AND COALESCE(oi.variacionIdDropi, '') = COALESCE(:variacionIdDropi, '')
        """)
    Optional<OrdenItemEntity> findExisting(Long ordenId, String productoIdDropi, String variacionIdDropi);

    /** KPIs bodega — devuelve UNA fila como List<Object[]> para parseo seguro */
    @Query(value = """
        SELECT COALESCE(SUM(oi.cantidad), 0)                    AS unidades_total,
               COALESCE(SUM(oi.precio_proveedor_x_cantidad), 0) AS costo_proveedor_total,
               COUNT(DISTINCT oi.orden_id)                      AS ordenes_con_items
        FROM orden_items oi
        WHERE oi.tenant_id = :tenantId
        """, nativeQuery = true)
    List<Object[]> kpiBodega(Long tenantId);

    /** Suma costo proveedor por orden — batch para la lista de órdenes (evita N+1) */
    @Query(value = """
        SELECT orden_id,
               COALESCE(SUM(precio_proveedor_x_cantidad), 0) AS costo_total
        FROM orden_items
        WHERE orden_id IN :ordenIds
        GROUP BY orden_id
        """, nativeQuery = true)
    List<Object[]> sumCostoByOrdenIds(Collection<Long> ordenIds);
}
