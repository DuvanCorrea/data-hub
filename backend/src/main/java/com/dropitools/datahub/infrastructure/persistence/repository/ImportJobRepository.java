package com.dropitools.datahub.infrastructure.persistence.repository;

import com.dropitools.datahub.infrastructure.persistence.entity.ImportJobEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ImportJobRepository extends JpaRepository<ImportJobEntity, Long>, ImportJobRepositoryCustom {

    Page<ImportJobEntity> findByTenantId(Long tenantId, Pageable pageable);

    Page<ImportJobEntity> findByTenantIdAndStatus(Long tenantId, String status, Pageable pageable);

    Optional<ImportJobEntity> findByIdAndTenantId(Long id, Long tenantId);

}
