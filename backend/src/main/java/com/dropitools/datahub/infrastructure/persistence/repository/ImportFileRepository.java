package com.dropitools.datahub.infrastructure.persistence.repository;

import com.dropitools.datahub.infrastructure.persistence.entity.ImportFileEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ImportFileRepository extends JpaRepository<ImportFileEntity, Long> {
    Optional<ImportFileEntity> findByTenantIdAndSha256(Long tenantId, String sha256);
}
