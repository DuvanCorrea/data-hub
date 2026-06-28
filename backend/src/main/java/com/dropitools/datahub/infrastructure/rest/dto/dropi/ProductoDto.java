package com.dropitools.datahub.infrastructure.rest.dto.dropi;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Data @Builder
public class ProductoDto {
    private Long       id;
    private String     productoIdDropi;
    private String     sku;
    private String     nombre;
    private Long       qtyTotal;
    private Long       ordenesCount;
    private OffsetDateTime createdAt;
}
