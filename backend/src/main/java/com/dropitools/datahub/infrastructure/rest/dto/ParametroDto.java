package com.dropitools.datahub.infrastructure.rest.dto;

import lombok.Builder;
import lombok.Data;
import java.time.OffsetDateTime;
import java.util.List;

@Data @Builder
public class ParametroDto {
    private Long   id;
    private String aplicacion;
    private String clave;
    private String etiqueta;
    private String descripcion;
    private String tipoDato;
    private String valor;
    private String valorDefecto;
    private boolean valorModificado;     // valor != valorDefecto
    private List<OpcionDto> opciones;    // solo tipo SELECT
    private boolean esEditable;
    private int orden;
    private OffsetDateTime updatedAt;
    private Long updatedBy;

    @Data @Builder
    public static class OpcionDto {
        private String valor;
        private String etiqueta;
    }
}
