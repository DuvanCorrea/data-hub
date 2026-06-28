package com.dropitools.datahub.infrastructure.processor;

import com.dropitools.datahub.domain.model.ImportJob;
import com.dropitools.datahub.domain.port.ImportProcessor;
import com.dropitools.datahub.infrastructure.persistence.entity.ImportJobEntity;
import com.dropitools.datahub.infrastructure.persistence.entity.StgDropiOrderProductEntity;
import com.dropitools.datahub.infrastructure.persistence.repository.ImportJobRepository;
import com.dropitools.datahub.infrastructure.persistence.repository.StgDropiOrderProductRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Procesador concreto para la plantilla DOPI_ORDER_PRODUCT.
 *
 * Cubre el reporte "Órdenes por Producto" de Dropi (un renglón por
 * orden × producto).  Implementa las dos fases del ImportProcessor:
 *   1. loadToStaging  → Excel → stg_dropi_order_product
 *   2. processStaging → staging-only (marca filas PROCESSED; la tabla
 *      final de productos se construirá en un sprint posterior)
 *
 * Para añadir otro tipo de archivo basta con crear un nuevo @Service
 * que implemente ImportProcessor con su propio TEMPLATE.  El scheduler
 * lo descubre automáticamente sin cambios en ningún otro lugar.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DropiOrderProductProcessor implements ImportProcessor {

    private static final String TEMPLATE   = "DOPI_ORDER_PRODUCT";
    private static final int    BATCH_SIZE = 100;

    private final DropiExcelReader               excelReader;
    private final StgDropiOrderProductRepository stagingRepo;
    private final ImportJobRepository            jobRepo;
    private final EntityManager                  em;

    // ── Discriminador de plantilla ────────────────────────────────────────

    @Override
    public boolean supports(String template) {
        return TEMPLATE.equalsIgnoreCase(template);
    }

    // ── FASE 1: Excel → stg_dropi_order_product ───────────────────────────

    @Override
    @Transactional
    public void loadToStaging(ImportJob job, Path filePath) {
        if (!Files.exists(filePath)) {
            failJob(job.getId(), "Archivo no encontrado en almacenamiento: " + filePath);
            return;
        }

        log.info("{\"action\":\"STAGING_START\",\"template\":\"{}\",\"jobId\":{},\"file\":\"{}\"}",
                TEMPLATE, job.getId(), filePath.getFileName());

        List<Map<String, String>> rows;
        try {
            rows = excelReader.readRows(filePath);
        } catch (IllegalStateException e) {
            failJob(job.getId(), e.getMessage());
            return;
        }

        List<StgDropiOrderProductEntity> batch = new ArrayList<>(BATCH_SIZE);
        int rowNum = 1;

        for (Map<String, String> row : rows) {
            batch.add(mapRowToStaging(row, job, rowNum++));

            if (batch.size() == BATCH_SIZE) {
                stagingRepo.saveAll(batch);
                em.flush();
                em.clear();
                batch.clear();
            }
        }
        if (!batch.isEmpty()) {
            stagingRepo.saveAll(batch);
        }

        ImportJobEntity jobEntity = jobRepo.findById(job.getId()).orElseThrow();
        jobEntity.setRowsTotal(rows.size());
        jobRepo.save(jobEntity);

        log.info("{\"action\":\"STAGING_DONE\",\"template\":\"{}\",\"jobId\":{},\"rowsTotal\":{}}",
                TEMPLATE, job.getId(), rows.size());
    }

    // ── FASE 2: staging-only (sin upsert a tabla final por ahora) ─────────

    @Override
    @Transactional
    public void processStaging(ImportJob job) {
        log.info("{\"action\":\"PROCESS_START\",\"template\":\"{}\",\"jobId\":{}}", TEMPLATE, job.getId());

        while (true) {
            List<StgDropiOrderProductEntity> batch = stagingRepo.findByImportJobIdAndProcessingStatus(
                    job.getId(), "PENDING", PageRequest.of(0, BATCH_SIZE));

            if (batch.isEmpty()) break;

            OffsetDateTime now = OffsetDateTime.now();
            for (StgDropiOrderProductEntity stg : batch) {
                // Staging-only: marca como PROCESSED sin upsert a tabla final.
                // La lógica de transformación hacia una tabla normalizada de
                // productos se implementará en el próximo sprint.
                stg.setProcessingStatus("PROCESSED");
                stg.setProcessedAt(now);
            }
            stagingRepo.saveAll(batch);

            long done = stagingRepo.countByImportJobIdAndProcessingStatus(job.getId(), "PROCESSED");
            ImportJobEntity jobEntity = jobRepo.findById(job.getId()).orElseThrow();
            jobEntity.setRowsDone((int) done);
            jobRepo.save(jobEntity);
        }

        ImportJobEntity jobEntity = jobRepo.findById(job.getId()).orElseThrow();
        jobEntity.setStatus("COMPLETED");
        jobEntity.setFinishedAt(OffsetDateTime.now());
        jobRepo.save(jobEntity);

        log.info("{\"action\":\"JOB_COMPLETED\",\"template\":\"{}\",\"tenantId\":{},\"jobId\":{},\"rowsDone\":{}}",
                TEMPLATE, job.getTenantId(), job.getId(), jobEntity.getRowsDone());
    }

    // ── Mapeo fila Excel → entidad staging ───────────────────────────────
    //
    // Las claves del Map corresponden a los nombres de cabecera del Excel
    // convertidos a minúsculas por DropiExcelReader.  Se documentan las
    // diferencias de acentuación respecto al reporte DROPI_ORDER.

    private StgDropiOrderProductEntity mapRowToStaging(Map<String, String> row,
                                                        ImportJob job, int rowNum) {
        StgDropiOrderProductEntity e = new StgDropiOrderProductEntity();
        e.setImportJobId(job.getId());
        e.setTenantId(job.getTenantId());
        e.setRowNumber(rowNum);

        // Columnas comunes
        e.setFechaDeReporte(row.get("fecha de reporte"));
        e.setIdDropi(row.get("id"));
        e.setHora(row.get("hora"));
        e.setFecha(row.get("fecha"));
        e.setNombreCliente(row.get("nombre cliente"));
        e.setTelefono(row.get("teléfono"));                        // con tilde — igual que DROPI_ORDER
        e.setEmail(row.get("email"));
        e.setTipoDeIdentificacion(row.get("tipo de identificacion")); // sin tilde en este reporte
        e.setNroDeIdentificacion(row.get("nro de identificacion"));   // sin tilde en este reporte
        e.setNumeroGuia(row.get("número guia"));                    // con tilde en "número"
        e.setEstatus(row.get("estatus"));
        e.setTipoDeEnvio(row.get("tipo de envio"));                 // sin tilde en este reporte
        e.setDepartamentoDestino(row.get("departamento destino"));
        e.setCiudadDestino(row.get("ciudad destino"));
        e.setDireccion(row.get("direccion"));                       // sin tilde en este reporte
        e.setNotas(row.get("notas"));
        e.setTransportadora(row.get("transportadora"));
        e.setTotalDeLaOrden(row.get("total de la orden"));
        e.setGanancia(row.get("ganancia"));
        e.setPrecioFlete(row.get("precio flete"));
        e.setCostoDevolucionFlete(row.get("costo devolucion flete")); // sin tilde en este reporte
        e.setComision(row.get("comision"));                         // sin tilde en este reporte

        // Columnas exclusivas de producto
        e.setPorcentajeComisionPlataforma(row.get("% comision de la plataformma")); // typo original del reporte
        e.setPrecioProveedor(row.get("precio proveedor"));
        e.setPrecioProveedorXCantidad(row.get("precio proveedor x cantidad"));
        e.setProductoId(row.get("producto id"));
        e.setSku(row.get("sku"));
        e.setVariacionId(row.get("variacion id"));
        e.setProducto(row.get("producto"));
        e.setVariacion(row.get("variacion"));
        e.setCantidad(row.get("cantidad"));

        // Novedad / movimientos
        e.setNovedad(row.get("novedad"));
        e.setFueSolucionadaLaNovedad(row.get("fue solucionada la novedad"));
        e.setHoraDeNovedad(row.get("hora de novedad"));
        e.setFechaDeNovedad(row.get("fecha de novedad"));
        e.setSolucion(row.get("solución"));                         // con tilde — igual que DROPI_ORDER
        e.setHoraDeSolucion(row.get("hora de solución"));
        e.setFechaDeSolucion(row.get("fecha de solución"));
        e.setObservacion(row.get("observación"));                   // con tilde — igual que DROPI_ORDER
        e.setHoraDeUltimoMovimiento(row.get("hora de último movimiento"));   // con tilde en este reporte
        e.setFechaDeUltimoMovimiento(row.get("fecha de último movimiento")); // con tilde en este reporte
        e.setUltimoMovimiento(row.get("último movimiento"));                 // con tilde en este reporte
        e.setConceptoUltimoMovimiento(row.get("concepto último movimiento")); // con tilde en este reporte
        e.setUbicacionDeUltimoMovimiento(row.get("ubicación de último movimiento")); // con tilde en este reporte

        // Tienda / logística
        e.setVendedor(row.get("vendedor"));
        e.setTipoDeTienda(row.get("tipo de tienda"));
        e.setTienda(row.get("tienda"));
        e.setIdDeOrdenDeTienda(row.get("id de orden de tienda"));
        e.setNumeroDePedidoDeTienda(row.get("numero de pedido de tienda"));
        e.setTags(row.get("tags"));
        e.setFechaGuiaGenerada(row.get("fecha guia generada"));     // nombre distinto al de DROPI_ORDER
        e.setContadorDeIndemnizaciones(row.get("contador de indemnizaciones"));
        e.setConceptoUltimaIndenmizacion(row.get("concepto última indenmización")); // con tildes en este reporte

        return e;
    }

    // ── Helper ────────────────────────────────────────────────────────────

    private void failJob(Long jobId, String errorMsg) {
        log.error("{\"action\":\"JOB_FAILED\",\"template\":\"{}\",\"jobId\":{},\"error\":\"{}\"}",
                TEMPLATE, jobId, errorMsg);
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus("ERROR");
            j.setErrorMsg(errorMsg);
            j.setFinishedAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }
}
