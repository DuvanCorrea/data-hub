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
 * Dado un jobId (o template) resuelve qué StagingTableReader usar y delega la consulta.
 * Para añadir un nuevo template solo se añade un @Component que implemente
 * StagingTableReader — Spring lo inyecta aquí automáticamente.
 */
@Service
@RequiredArgsConstructor
public class StagingService {

    private final ImportJobRepository jobRepository;
    /** Spring inyecta TODOS los beans que implementen StagingTableReader */
    private final List<StagingTableReader> readers;

    /** Vista filtrada por job específico */
    public StagingPageResponse getPage(Long tenantId, Long jobId,
                                       int page, int size,
                                       String sortBy, String sortDir) {

        ImportJobEntity job = jobRepository.findByIdAndTenantId(jobId, tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Job no encontrado o no pertenece a este tenant."));

        StagingTableReader reader = resolveReader(job.getTemplate());
        Page<Map<String, Object>> dataPage = reader.getRows(tenantId, jobId, page, size, sortBy, sortDir);

        return buildResponse(job.getTemplate(), reader, dataPage, page);
    }

    /** Vista global: todos los registros del tenant para un template dado */
    public StagingPageResponse getAllPage(Long tenantId, String template,
                                          int page, int size,
                                          String sortBy, String sortDir) {

        StagingTableReader reader = resolveReader(template);
        Page<Map<String, Object>> dataPage = reader.getAllRows(tenantId, page, size, sortBy, sortDir);

        return buildResponse(template, reader, dataPage, page);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private StagingTableReader resolveReader(String template) {
        return readers.stream()
                .filter(r -> r.getTemplate().equalsIgnoreCase(template))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED,
                        "No hay visor de staging para el template: " + template));
    }

    private StagingPageResponse buildResponse(String template, StagingTableReader reader,
                                               Page<Map<String, Object>> dataPage, int page) {
        return StagingPageResponse.builder()
                .template(template)
                .columns(reader.getColumns())
                .rows(dataPage.getContent())
                .totalElements(dataPage.getTotalElements())
                .totalPages(dataPage.getTotalPages())
                .page(dataPage.getNumber())
                .size(dataPage.getSize())
                .build();
    }
}
