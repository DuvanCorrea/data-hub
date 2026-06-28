package com.dropitools.datahub.infrastructure.staging;

import com.dropitools.datahub.domain.port.StagingTableReader;
import com.dropitools.datahub.infrastructure.persistence.entity.StgDropiOrderEntity;
import com.dropitools.datahub.infrastructure.persistence.repository.StgDropiOrderRepository;
import com.dropitools.datahub.infrastructure.rest.dto.StagingColumnDef;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Implementación de StagingTableReader para el template DROPI_ORDER.
 *
 * Para añadir otra integración simplemente crea otro @Component
 * que implemente StagingTableReader con su propio getTemplate().
 */
@Component
@RequiredArgsConstructor
public class DropiOrderStagingReader implements StagingTableReader {

    private final StgDropiOrderRepository repo;

    private static final List<StagingColumnDef> COLUMNS = List.of(
            new StagingColumnDef("id",                         "ID",                       "number"),
            new StagingColumnDef("rowNumber",                  "Fila",                     "number"),
            new StagingColumnDef("processingStatus",           "Estado staging",           "status"),
            new StagingColumnDef("idDropi",                    "ID Dropi",                 "text"),
            new StagingColumnDef("ordenDeDropshipper",         "Orden dropshipper",        "text"),
            new StagingColumnDef("fechaDeReporte",             "Fecha reporte",            "text"),
            new StagingColumnDef("fecha",                      "Fecha",                    "text"),
            new StagingColumnDef("hora",                       "Hora",                     "text"),
            new StagingColumnDef("nombreCliente",              "Cliente",                  "text"),
            new StagingColumnDef("telefono",                   "Teléfono",                 "text"),
            new StagingColumnDef("email",                      "Email",                    "text"),
            new StagingColumnDef("estatus",                    "Estatus",                  "text"),
            new StagingColumnDef("tipoDeEnvio",                "Tipo envío",               "text"),
            new StagingColumnDef("departamentoDestino",        "Departamento",             "text"),
            new StagingColumnDef("ciudadDestino",              "Ciudad",                   "text"),
            new StagingColumnDef("direccion",                  "Dirección",                "text"),
            new StagingColumnDef("numeroGuia",                 "Guía",                     "text"),
            new StagingColumnDef("transportadora",             "Transportadora",           "text"),
            new StagingColumnDef("numeroDeFactura",            "Factura",                  "text"),
            new StagingColumnDef("valorFacturado",             "Valor facturado",          "number"),
            new StagingColumnDef("totalDeLaOrden",             "Total orden",              "number"),
            new StagingColumnDef("ganancia",                   "Ganancia",                 "number"),
            new StagingColumnDef("precioFlete",                "Precio flete",             "number"),
            new StagingColumnDef("costoDevolucionFlete",       "Costo dev. flete",         "number"),
            new StagingColumnDef("comision",                   "Comisión",                 "number"),
            new StagingColumnDef("novedad",                    "Novedad",                  "text"),
            new StagingColumnDef("fueSolucionadaLaNovedad",    "¿Novedad solucionada?",    "text"),
            new StagingColumnDef("fechaDeNovedad",             "Fecha novedad",            "text"),
            new StagingColumnDef("solucion",                   "Solución",                 "text"),
            new StagingColumnDef("ultimoMovimiento",           "Último movimiento",        "text"),
            new StagingColumnDef("conceptoUltimoMovimiento",   "Concepto últ. mov.",       "text"),
            new StagingColumnDef("ubicacionDeUltimoMovimiento","Ubicación últ. mov.",      "text"),
            new StagingColumnDef("vendedor",                   "Vendedor",                 "text"),
            new StagingColumnDef("tipoDeTienda",               "Tipo tienda",              "text"),
            new StagingColumnDef("tienda",                     "Tienda",                   "text"),
            new StagingColumnDef("errorDetail",                "Detalle error",            "text"),
            new StagingColumnDef("createdAt",                  "Creado",                   "datetime")
    );

    // Columnas que el front permite usar para el sort
    private static final java.util.Set<String> SORTABLE = java.util.Set.of(
            "id", "rowNumber", "processingStatus", "idDropi", "fechaDeReporte",
            "estatus", "nombreCliente", "createdAt"
    );

    @Override
    public String getTemplate() {
        return "DROPI_ORDER";
    }

    @Override
    public List<StagingColumnDef> getColumns() {
        return COLUMNS;
    }

    @Override
    public Page<Map<String, Object>> getRows(Long tenantId, Long jobId,
                                              int page, int size,
                                              String sortBy, String sortDir) {
        // Sanitizar sortBy para evitar inyección de campo
        String safeSortBy = SORTABLE.contains(sortBy) ? sortBy : "id";
        Sort.Direction dir = "desc".equalsIgnoreCase(sortDir) ? Sort.Direction.DESC : Sort.Direction.ASC;
        PageRequest pageable = PageRequest.of(page, size, Sort.by(dir, safeSortBy));

        Page<StgDropiOrderEntity> entityPage = repo.findByTenantIdAndImportJobId(tenantId, jobId, pageable);
        return entityPage.map(this::toMap);
    }

    private Map<String, Object> toMap(StgDropiOrderEntity e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",                          e.getId());
        m.put("rowNumber",                   e.getRowNumber());
        m.put("processingStatus",            e.getProcessingStatus());
        m.put("idDropi",                     e.getIdDropi());
        m.put("ordenDeDropshipper",          e.getOrdenDeDropshipper());
        m.put("fechaDeReporte",              e.getFechaDeReporte());
        m.put("fecha",                       e.getFecha());
        m.put("hora",                        e.getHora());
        m.put("nombreCliente",               e.getNombreCliente());
        m.put("telefono",                    e.getTelefono());
        m.put("email",                       e.getEmail());
        m.put("estatus",                     e.getEstatus());
        m.put("tipoDeEnvio",                 e.getTipoDeEnvio());
        m.put("departamentoDestino",         e.getDepartamentoDestino());
        m.put("ciudadDestino",               e.getCiudadDestino());
        m.put("direccion",                   e.getDireccion());
        m.put("numeroGuia",                  e.getNumeroGuia());
        m.put("transportadora",              e.getTransportadora());
        m.put("numeroDeFactura",             e.getNumeroDeFactura());
        m.put("valorFacturado",              e.getValorFacturado());
        m.put("totalDeLaOrden",              e.getTotalDeLaOrden());
        m.put("ganancia",                    e.getGanancia());
        m.put("precioFlete",                 e.getPrecioFlete());
        m.put("costoDevolucionFlete",        e.getCostoDevolucionFlete());
        m.put("comision",                    e.getComision());
        m.put("novedad",                     e.getNovedad());
        m.put("fueSolucionadaLaNovedad",     e.getFueSolucionadaLaNovedad());
        m.put("fechaDeNovedad",              e.getFechaDeNovedad());
        m.put("solucion",                    e.getSolucion());
        m.put("ultimoMovimiento",            e.getUltimoMovimiento());
        m.put("conceptoUltimoMovimiento",    e.getConceptoUltimoMovimiento());
        m.put("ubicacionDeUltimoMovimiento", e.getUbicacionDeUltimoMovimiento());
        m.put("vendedor",                    e.getVendedor());
        m.put("tipoDeTienda",                e.getTipoDeTienda());
        m.put("tienda",                      e.getTienda());
        m.put("errorDetail",                 e.getErrorDetail());
        m.put("createdAt",                   e.getCreatedAt() != null ? e.getCreatedAt().toString() : null);
        return m;
    }
}
