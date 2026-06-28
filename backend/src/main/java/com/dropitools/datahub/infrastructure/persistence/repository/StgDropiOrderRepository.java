package com.dropitools.datahub.infrastructure.persistence.repository;

import com.dropitools.datahub.infrastructure.persistence.entity.StgDropiOrderEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StgDropiOrderRepository extends JpaRepository<StgDropiOrderEntity, Long> {

    /** Filas PENDING de un job listas para el UPSERT, procesadas en lotes pequeños */
    List<StgDropiOrderEntity> findByImportJobIdAndProcessingStatus(
            Long importJobId, String processingStatus, Pageable pageable);

    /** Cuenta errores por job para el log final */
    long countByImportJobIdAndProcessingStatus(Long importJobId, String processingStatus);

    /** Borra filas de staging de un job (limpieza tras completar) */
    @Modifying
    @Query("DELETE FROM StgDropiOrderEntity s WHERE s.importJobId = :jobId")
    void deleteByImportJobId(Long jobId);

    /** Página de filas de staging de un job (para el visor CRUD por job) */
    Page<StgDropiOrderEntity> findByTenantIdAndImportJobId(
            Long tenantId, Long importJobId, Pageable pageable);

    /** Página de TODAS las filas del tenant (vista global) */
    Page<StgDropiOrderEntity> findByTenantId(Long tenantId, Pageable pageable);

    /** Cuenta total de filas de un job por tenant */
    long countByTenantIdAndImportJobId(Long tenantId, Long importJobId);
}
