package com.dropitools.datahub.infrastructure.rest.dto.dropi;

import lombok.Builder;
import lombok.Data;
import java.time.OffsetDateTime;

@Data @Builder
public class ProductoVariacionDto {
    private Long   id;
    private String variacionIdDropi;
    private String nombreVariacion;
    private OffsetDateTime createdAt;
}
