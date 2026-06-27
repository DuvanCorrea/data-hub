package com.dropitools.datahub.application;

import com.dropitools.datahub.domain.model.ImportJob;
import com.dropitools.datahub.domain.port.ImportProcessor;
import com.dropitools.datahub.infrastructure.persistence.entity.ImportJobEntity;
import com.dropitools.datahub.infrastructure.persistence.repository.ImportFileRepository;
import com.dropitools.datahub.infrastructure.persistence.repository.ImportJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
@EnableScheduling
public class ImportJobScheduler {

    private final ImportJobRepository jobRepository;
    private final ImportFileRepository fileRepository;
    private final List<ImportProcessor> processors;  // Spring inyecta todos los implementors

    /**
     * Poll cada N ms: toma el siguiente job PENDING de forma atómica y lo procesa.
     */
    @Scheduled(fixedDelayString = "${app.scheduler.fixed-delay-ms:5000}")
    @Transactional
    public void processNextJob() {
        try {
            jobRepository.claimNextPending().ifPresent(jobId -> {
                ImportJobEntity entity = jobRepository.findById(jobId).orElseThrow();
                log.info("{\"action\":\"JOB_CLAIMED\",\"jobId\":{}}", jobId);

                // Buscar el archivo en disco
                fileRepository.findById(entity.getFileId()).ifPresentOrElse(file -> {
                    Path filePath = Path.of(file.getStoredPath());
                    ImportJob job = toModel(entity);

                    // Buscar el procesador adecuado para la plantilla
                    processors.stream()
                            .filter(p -> p.supports(entity.getTemplate()))
                            .findFirst()
                            .ifPresentOrElse(
                                    processor -> {
                                        processor.loadToStaging(job, filePath);
                                        processor.processStaging(job);
                                    },
                                    () -> failJob(jobId, "No hay procesador para template: " + entity.getTemplate())
                            );
                }, () -> failJob(jobId, "Archivo ID " + entity.getFileId() + " no encontrado en BD"));
            });
        } catch (Exception e) {
            log.error("{\"action\":\"SCHEDULER_ERROR\",\"error\":\"{}\"}", e.getMessage(), e);
        }
    }

    /**
     * Al arrancar, reseta jobs huérfanos (RUNNING pero sin actualización en X minutos).
     */
    @Scheduled(initialDelay = 5000, fixedDelay = 300_000) // 5 min
    public void recoverOrphanJobs() {
        jobRepository.findAll().stream()
                .filter(j -> "RUNNING".equals(j.getStatus())
                        && j.getUpdatedAt() != null
                        && j.getUpdatedAt().isBefore(OffsetDateTime.now().minusMinutes(10)))
                .forEach(j -> {
                    j.setStatus("PENDING");
                    jobRepository.save(j);
                    log.warn("{\"action\":\"JOB_RECOVERED\",\"tenantId\":{},\"jobId\":{}}", j.getTenantId(), j.getId());
                });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void failJob(Long jobId, String errorMsg) {
        log.error("{\"action\":\"JOB_FAILED\",\"jobId\":{},\"error\":\"{}\"}", jobId, errorMsg);
        jobRepository.findById(jobId).ifPresent(j -> {
            j.setStatus("ERROR");
            j.setErrorMsg(errorMsg);
            j.setFinishedAt(OffsetDateTime.now());
            jobRepository.save(j);
        });
    }

    private ImportJob toModel(ImportJobEntity e) {
        return ImportJob.builder()
                .id(e.getId())
                .tenantId(e.getTenantId())
                .fileId(e.getFileId())
                .template(e.getTemplate())
                .status(e.getStatus())
                .rowsTotal(e.getRowsTotal())
                .rowsDone(e.getRowsDone())
                .build();
    }
}
