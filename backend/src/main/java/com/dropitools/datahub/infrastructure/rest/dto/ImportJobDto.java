package com.dropitools.datahub.infrastructure.rest.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ImportJobDto {
    private Long id;
    private String status;
    private int progress;
    private int rowsDone;
    private int rowsTotal;
    private String template;
    private String startedAt;
    private String finishedAt;
    private String errorMsg;
}
