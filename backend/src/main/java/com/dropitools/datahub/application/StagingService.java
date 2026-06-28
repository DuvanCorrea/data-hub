package com.dropitools.datahub.application;

import com.dropitools.datahub.domain.port.StagingTableReader;
import com.dropitools.datahub.infrastructure.persistence.entity.ImportJobEntity;
import com.dropitools.datahub.infrastructure.persistence.repository.ImportJobRepository;
import com.dropitools.datahub.infrastructure.rest.dto.StagingPageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * Servicio genérico de staging.
 * Dado un jobId resuelve qué StagingTableReader usar (por template)
 * y delega la consulta.  Para añadir un nuevo template solo se añade
 * un nuevo @Component que implemente StagingTableReader — Spring lo
 * inyecta aquí automáticamente.
 */
@Service
@RequiredArgsConstructor
public class StagingService {

    private final ImportJobRepository jobRepository;
    /** Spring inyecta TODOS los beans que implementen StagingTableReader */
    private final List<StagingTableReader> readers;

    public StagingPageResponse getPage(Long tenantId, Long jobId,
                                       int page, int size,
                                       String sortBy, String sortDir) {

        ImportJobEntity job = jobRepository.findByIdAndTenantId(jobId, tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Job no encontrado o no pertenece a este tenant."));

        StagingTableReader reader = readers.stream()
                .filter(r -> r.getTemplate().equalsIgnoreCase(job.getTemplate()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED,
                        "No hay visor de staging para el template: " + job.getTemplate()));

        Page<Map<String, Object>> dataPage = reader.getRows(tenantId, jobId, page, size, sortBy, sortDir);

        return StagingPageResponse.builder()
                .template(job.getTemplate())
                .columns(reader.getColumns())
                .rows(dataPage.getContent())
                .totalElements(dataPage.getTotalElements())
                .totalPages(dataPage.getTotalPages())
                .page(dataPage.getNumber())
                .size(dataPage.getSize())
                .build();
    }
}
