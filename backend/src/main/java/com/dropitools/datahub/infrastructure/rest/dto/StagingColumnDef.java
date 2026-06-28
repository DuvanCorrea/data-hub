package com.dropitools.datahub.infrastructure.rest.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * Descriptor de columna que el frontend usa para renderizar
 * la tabla de staging de forma dinámica.
 */
@Data
@AllArgsConstructor
public class StagingColumnDef {
    /** Clave del campo en el map de cada fila */
    private String key;
    /** Etiqueta legible para el header */
    private String label;
    /** Tipo sugerido: "text" | "number" | "datetime" | "status" */
    private String type;
}
