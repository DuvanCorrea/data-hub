package com.dropitools.datahub.domain.port;

import com.dropitools.datahub.infrastructure.rest.dto.StagingColumnDef;
import org.springframework.data.domain.Page;

import java.util.List;
import java.util.Map;

/**
 * Puerto extensible: cada integración (Dropi, futura X, Y…)
 * implementa este puerto para exponer su tabla de staging
 * de forma homogénea al controlador.
 *
 * Añadir una nueva integración = nueva clase que implemente esta interfaz
 * + registrarla en StagingService.
 */
public interface StagingTableReader {

    /**
     * Identificador del template que este reader maneja.
     * Debe coincidir con ImportJobEntity.template (ej. "DROPI_ORDER").
     */
    String getTemplate();

    /**
     * Columnas en el orden en que deben mostrarse en la tabla.
     */
    List<StagingColumnDef> getColumns();

    /**
     * Filas paginadas para el job indicado, filtradas por tenantId.
     * Cada fila es un mapa columna → valor (puede contener nulls).
     */
    Page<Map<String, Object>> getRows(Long tenantId, Long jobId,
                                       int page, int size,
                                       String sortBy, String sortDir);
}
