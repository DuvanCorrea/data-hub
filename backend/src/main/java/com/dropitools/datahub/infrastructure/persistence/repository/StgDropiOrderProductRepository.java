package com.dropitools.datahub.infrastructure.persistence.repository;

import com.dropitools.datahub.infrastructure.persistence.entity.StgDropiOrderProductEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StgDropiOrderProductRepository
        extends JpaRepository<StgDropiOrderProductEntity, Long> {

    /** Filas PENDING de un job listas para procesar, en lotes pequeños */
    List<StgDropiOrderProductEntity> findByImportJobIdAndProcessingStatus(
            Long importJobId, String processingStatus, Pageable pageable);

    /** Cuenta registros por estado dentro de un job */
    long countByImportJobIdAndProcessingStatus(Long importJobId, String processingStatus);

    /** Borra filas de staging de un job (limpieza opcional tras completar) */
    @Modifying
    @Query("DELETE FROM StgDropiOrderProductEntity s WHERE s.importJobId = :jobId")
    void deleteByImportJobId(Long jobId);

    /** Página de filas de un job específico (para el visor por job) */
    Page<StgDropiOrderProductEntity> findByTenantIdAndImportJobId(
            Long tenantId, Long importJobId, Pageable pageable);

    /** Página de TODAS las filas del tenant (vista global) */
    Page<StgDropiOrderProductEntity> findByTenantId(Long tenantId, Pageable pageable);

    /** Cuenta total de filas de un job por tenant */
    long countByTenantIdAndImportJobId(Long tenantId, Long importJobId);
}
