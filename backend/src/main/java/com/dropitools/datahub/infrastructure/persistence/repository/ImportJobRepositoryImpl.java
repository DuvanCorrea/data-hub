package com.dropitools.datahub.infrastructure.persistence.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

public class ImportJobRepositoryImpl implements ImportJobRepositoryCustom {

    @PersistenceContext
    private EntityManager em;

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<Long> claimNextPending() {
        String sql = """
            UPDATE import_jobs SET status='RUNNING', started_at=NOW(), updated_at=NOW()
            WHERE id = (
              SELECT id FROM import_jobs
              WHERE status='PENDING'
              ORDER BY created_at ASC
              LIMIT 1
              FOR UPDATE SKIP LOCKED
            )
            RETURNING id
            """;
            
        var result = em.createNativeQuery(sql).getResultList();
        
        if (result.isEmpty()) {
            return Optional.empty();
        }
        
        return Optional.of(((Number) result.get(0)).longValue());
    }
}
