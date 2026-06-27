package com.dropitools.datahub.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

/**
 * Entidad de dominio: ImportJob.
 * Representa el estado de un trabajo de importación de Excel.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportJob {

    public enum Status { PENDING, RUNNING, COMPLETED, ERROR }

    private Long id;
    private Long tenantId;
    private Long fileId;
    private String template;
    private String status; // PENDING | RUNNING | COMPLETED | ERROR
    private Integer rowsTotal;
    private int rowsDone;
    private String errorMsg;
    private OffsetDateTime createdAt;
    private OffsetDateTime startedAt;
    private OffsetDateTime finishedAt;
    private OffsetDateTime updatedAt;

    /** Progreso en porcentaje (0 si rowsTotal aún es null). */
    public int getProgress() {
        if (rowsTotal == null || rowsTotal == 0) return 0;
        return rowsDone * 100 / rowsTotal;
    }
}
