package com.dropitools.datahub.infrastructure.persistence.repository;

import com.dropitools.datahub.infrastructure.persistence.entity.ClienteEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ClienteRepository extends JpaRepository<ClienteEntity, Long> {

    Optional<ClienteEntity> findByTenantIdAndTelefono(Long tenantId, String telefono);

    Page<ClienteEntity> findByTenantId(Long tenantId, Pageable pageable);

    @Query("""
        SELECT c FROM ClienteEntity c
        WHERE c.tenantId = :tenantId
          AND (LOWER(c.nombre) LIKE LOWER(CONCAT('%',:q,'%'))
            OR c.telefono LIKE CONCAT('%',:q,'%')
            OR LOWER(c.email) LIKE LOWER(CONCAT('%',:q,'%')))
        """)
    Page<ClienteEntity> search(Long tenantId, String q, Pageable pageable);
}
