package com.dropitools.datahub.infrastructure.persistence.repository;

import com.dropitools.datahub.infrastructure.persistence.entity.TiendaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface TiendaRepository extends JpaRepository<TiendaEntity, Long> {
    Optional<TiendaEntity> findByTenantIdAndNombre(Long tenantId, String nombre);
}
