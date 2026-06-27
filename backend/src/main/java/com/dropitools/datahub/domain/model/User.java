package com.dropitools.datahub.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

/**
 * Entidad de dominio: User.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {
    private Long id;
    private Long tenantId;
    private String username;
    // ⚠️ password excluido intencionalmente — nunca debe exponerse en respuestas de API
    private String role;
    private Boolean isActive;
    private OffsetDateTime createdAt;
}
