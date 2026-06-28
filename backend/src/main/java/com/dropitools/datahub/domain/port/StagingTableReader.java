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
 * Añadir una nueva integración = nueva clase que implemente esta interfaz.
 */
public interface StagingTableReader {

    /** Identificador del template (ej. "DROPI_ORDER"). */
    String getTemplate();

    /** Columnas en el orden en que deben mostrarse. */
    List<StagingColumnDef> getColumns();

    /**
     * Filas paginadas para un job concreto, filtradas por tenantId.
     */
    Page<Map<String, Object>> getRows(Long tenantId, Long jobId,
                                       int page, int size,
                                       String sortBy, String sortDir);

    /**
     * Filas paginadas de TODOS los jobs del tenant (vista global).
     * Default implementado — los readers pueden sobreescribirlo.
     */
    Page<Map<String, Object>> getAllRows(Long tenantId,
                                         int page, int size,
                                         String sortBy, String sortDir);
}
