package com.dropitools.datahub.infrastructure.persistence.repository;

import com.dropitools.datahub.infrastructure.persistence.entity.VendedorEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface VendedorRepository extends JpaRepository<VendedorEntity, Long> {
    Optional<VendedorEntity> findByTenantIdAndNombre(Long tenantId, String nombre);
}
