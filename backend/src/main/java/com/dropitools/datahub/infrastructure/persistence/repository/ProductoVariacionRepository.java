package com.dropitools.datahub.infrastructure.persistence.repository;

import com.dropitools.datahub.infrastructure.persistence.entity.ProductoVariacionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductoVariacionRepository extends JpaRepository<ProductoVariacionEntity, Long> {

    @Query("""
        SELECT pv FROM ProductoVariacionEntity pv
        WHERE pv.tenantId = :tenantId
          AND pv.productoId = :productoId
          AND COALESCE(pv.variacionIdDropi, '') = COALESCE(:variacionIdDropi, '')
          AND COALESCE(pv.nombreVariacion, '')  = COALESCE(:nombreVariacion, '')
        """)
    Optional<ProductoVariacionEntity> findExisting(Long tenantId, Long productoId,
                                                    String variacionIdDropi, String nombreVariacion);

    List<ProductoVariacionEntity> findByTenantIdAndProductoId(Long tenantId, Long productoId);
}
