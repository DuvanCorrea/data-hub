package com.dropitools.datahub.infrastructure.rest.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * Respuesta genérica de paginación para cualquier tabla de staging.
 * Las columnas vienen definidas dinámicamente; las filas son mapas
 * clave → valor para que el frontend las renderice sin conocer la
 * estructura de antemano.
 */
@Data
@Builder
public class StagingPageResponse {
    /** Tipo de template/tabla (ej. "DROPI_ORDER") — útil para el front */
    private String template;
    /** Definición de columnas en orden */
    private List<StagingColumnDef> columns;
    /** Filas de datos */
    private List<Map<String, Object>> rows;
    /** Total de elementos sin paginar */
    private long totalElements;
    /** Total de páginas */
    private int totalPages;
    /** Página actual (0-indexed) */
    private int page;
    /** Tamaño de la página */
    private int size;
}
