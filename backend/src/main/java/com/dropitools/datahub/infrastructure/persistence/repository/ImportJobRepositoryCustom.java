package com.dropitools.datahub.infrastructure.persistence.repository;

import java.util.Optional;

public interface ImportJobRepositoryCustom {
    /**
     * Claim atómico de un job PENDING usando FOR UPDATE SKIP LOCKED
     * para evitar race conditions cuando escalen a múltiples workers.
     * @return el ID del job asignado, si existe.
     */
    Optional<Long> claimNextPending();
}
