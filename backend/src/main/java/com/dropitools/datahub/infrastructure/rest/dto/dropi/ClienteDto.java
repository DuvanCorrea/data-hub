package com.dropitools.datahub.infrastructure.rest.dto.dropi;

import lombok.Builder;
import lombok.Data;
import java.time.OffsetDateTime;

@Data @Builder
public class ClienteDto {
    private Long   id;
    private String nombre;
    private String telefono;
    private String email;
    private String tipoIdentificacion;
    private String nroIdentificacion;
    private OffsetDateTime createdAt;
}
