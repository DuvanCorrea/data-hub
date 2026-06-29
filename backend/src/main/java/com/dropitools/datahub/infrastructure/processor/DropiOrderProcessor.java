package com.dropitools.datahub.infrastructure.processor;

import com.dropitools.datahub.application.DropisNormalizationService;
import com.dropitools.datahub.application.DropisNormalizationService.OrdenFields;
import com.dropitools.datahub.application.ParametroService;
import com.dropitools.datahub.domain.model.ImportJob;
import com.dropitools.datahub.domain.port.ImportProcessor;
import com.dropitools.datahub.infrastructure.persistence.entity.ImportJobEntity;
import com.dropitools.datahub.infrastructure.persistence.entity.StgDropiOrderEntity;
import com.dropitools.datahub.infrastructure.persistence.repository.ImportJobRepository;
import com.dropitools.datahub.infrastructure.persistence.repository.StgDropiOrderRepository;
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
 * Procesador para DROPI_ORDER.
 * Fase 1: Excel → stg_dropi_order
 * Fase 2: stg_dropi_order → tiendas + vendedores + clientes + ordenes (sin items)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DropiOrderProcessor implements ImportProcessor {

    private static final String TEMPLATE   = "DROPI_ORDER";
    private static final int    BATCH_SIZE = 100;

    private final DropiExcelReader              excelReader;
    private final StgDropiOrderRepository       stagingRepo;
    private final ImportJobRepository           jobRepo;
    private final EntityManager                 em;
    private final DropisNormalizationService    normService;
    private final ParametroService              parametroService;

    @Override
    public boolean supports(String template) { return TEMPLATE.equalsIgnoreCase(template); }

    // ── FASE 1: Excel → stg_dropi_order ──────────────────────────────────────

    @Override
    @Transactional
    public void loadToStaging(ImportJob job, Path filePath) {
        if (!Files.exists(filePath)) { failJob(job.getId(), "Archivo no encontrado: " + filePath); return; }
        log.info("{\"action\":\"STAGING_START\",\"template\":\"DROPI_ORDER\",\"jobId\":{}}", job.getId());

        List<Map<String, String>> rows;
        try { rows = excelReader.readRows(filePath); }
        catch (IllegalStateException e) { failJob(job.getId(), e.getMessage()); return; }

        List<StgDropiOrderEntity> batch = new ArrayList<>();
        int batchSize = parametroService.getBatchSize();
        int rowNum = 1;
        for (Map<String, String> row : rows) {
            batch.add(mapRowToStaging(row, job, rowNum++));
            if (batchSize < Integer.MAX_VALUE && batch.size() == batchSize) {
                stagingRepo.saveAll(batch); em.flush(); em.clear(); batch.clear();
            }
        }
        if (!batch.isEmpty()) stagingRepo.saveAll(batch);

        ImportJobEntity je = jobRepo.findById(job.getId()).orElseThrow();
        je.setRowsTotal(rows.size());
        jobRepo.save(je);
        log.info("{\"action\":\"STAGING_DONE\",\"template\":\"DROPI_ORDER\",\"jobId\":{},\"rows\":{}}", job.getId(), rows.size());
    }

    // ── FASE 2: stg → tiendas + vendedores + clientes + ordenes ──────────────

    @Override
    @Transactional
    public void processStaging(ImportJob job) {
        log.info("{\"action\":\"NORMALIZE_START\",\"template\":\"DROPI_ORDER\",\"jobId\":{}}", job.getId());
        long errors = 0;

        while (true) {
            int pageSize = Math.min(parametroService.getBatchSize(), 500); // cap de seguridad
            List<StgDropiOrderEntity> batch = stagingRepo.findByImportJobIdAndProcessingStatus(
                    job.getId(), "PENDING", PageRequest.of(0, pageSize));
            if (batch.isEmpty()) break;

            for (StgDropiOrderEntity stg : batch) {
                try {
                    normalize(stg, job.getTenantId());
                    stg.setProcessingStatus("PROCESSED");
                    stg.setProcessedAt(OffsetDateTime.now());
                } catch (Exception e) {
                    log.warn("Error normalizando fila {} job {}: {}", stg.getRowNumber(), job.getId(), e.getMessage());
                    stg.setProcessingStatus("ERROR");
                    stg.setErrorDetail(e.getMessage());
                    errors++;
                }
            }
            stagingRepo.saveAll(batch);

            long done = stagingRepo.countByImportJobIdAndProcessingStatus(job.getId(), "PROCESSED");
            ImportJobEntity je = jobRepo.findById(job.getId()).orElseThrow();
            je.setRowsDone((int) done);
            jobRepo.save(je);
        }

        ImportJobEntity je = jobRepo.findById(job.getId()).orElseThrow();
        je.setStatus("COMPLETED");
        je.setFinishedAt(OffsetDateTime.now());
        jobRepo.save(je);
        log.info("{\"action\":\"NORMALIZE_DONE\",\"template\":\"DROPI_ORDER\",\"jobId\":{},\"errors\":{}}", job.getId(), errors);
    }

    // ── Normalización de una fila ─────────────────────────────────────────────

    private void normalize(StgDropiOrderEntity stg, Long tenantId) {
        Long tiendaId   = normService.upsertTienda(tenantId, stg.getTienda(), stg.getTipoDeTienda());
        Long vendedorId = normService.upsertVendedor(tenantId, stg.getVendedor(), tiendaId);
        Long clienteId  = normService.upsertCliente(tenantId,
                stg.getNombreCliente(), stg.getTelefono(), stg.getEmail(),
                stg.getTipoDeIdentificacion(), stg.getNroDeIdentificacion());

        normService.upsertOrden(tenantId, stg.getIdDropi(), new OrdenFields(
                clienteId, tiendaId, vendedorId,
                stg.getFecha(), stg.getHora(), stg.getFechaDeReporte(), stg.getEstatus(),
                stg.getNumeroGuia(), stg.getTipoDeEnvio(), stg.getTransportadora(),
                stg.getDepartamentoDestino(), stg.getCiudadDestino(), stg.getDireccion(), stg.getCodigoPostal(),
                DropisNormalizationService.parseMoney(stg.getTotalDeLaOrden()),
                DropisNormalizationService.parseMoney(stg.getGanancia()),
                DropisNormalizationService.parseMoney(stg.getPrecioFlete()),
                DropisNormalizationService.parseMoney(stg.getCostoDevolucionFlete()),
                DropisNormalizationService.parseMoney(stg.getComision()),
                stg.getNumeroDeFactura(),
                DropisNormalizationService.parseMoney(stg.getValorFacturado()),
                stg.getOrdenDeDropshipper(), stg.getUsuarioGeneracionDeGuia(), stg.getCategorias(),
                stg.getIdDeOrdenDeTienda(), stg.getNumeroDePedidoDeTienda(), stg.getTags(),
                stg.getFechaGeneracionDeGuia(),
                stg.getNovedad(), stg.getFueSolucionadaLaNovedad(), stg.getFechaDeNovedad(),
                stg.getSolucion(), stg.getFechaDeSolucion(), stg.getObservacion(),
                stg.getUltimoMovimiento(), stg.getConceptoUltimoMovimiento(),
                stg.getUbicacionDeUltimoMovimiento(), stg.getFechaDeUltimoMovimiento(),
                stg.getContadorDeIndemnizaciones(), stg.getConceptoUltimaIndenmizacion(),
                stg.getNotas()
        ), false);
    }

    // ── Mapeo Excel → staging (sin cambios) ──────────────────────────────────

    private StgDropiOrderEntity mapRowToStaging(Map<String, String> row, ImportJob job, int rowNum) {
        StgDropiOrderEntity e = new StgDropiOrderEntity();
        e.setImportJobId(job.getId());
        e.setTenantId(job.getTenantId());
        e.setRowNumber(rowNum);
        e.setFechaDeReporte(row.get("fecha de reporte"));
        e.setIdDropi(row.get("id"));
        e.setOrdenDeDropshipper(row.get("orden de dropshipper"));
        e.setHora(row.get("hora"));
        e.setFecha(row.get("fecha"));
        e.setNombreCliente(row.get("nombre cliente"));
        e.setTelefono(row.get("teléfono"));
        e.setEmail(row.get("email"));
        e.setTipoDeIdentificacion(row.get("tipo de identificación"));
        e.setNroDeIdentificacion(row.get("nro de identificación"));
        e.setNumeroGuia(row.get("numero guia"));
        e.setEstatus(row.get("estatus"));
        e.setTipoDeEnvio(row.get("tipo de envío"));
        e.setDepartamentoDestino(row.get("departamento destino"));
        e.setCiudadDestino(row.get("ciudad destino"));
        e.setDireccion(row.get("dirección"));
        e.setNotas(row.get("notas"));
        e.setTransportadora(row.get("transportadora"));
        e.setNumeroDeFactura(row.get("número de factura"));
        e.setValorFacturado(row.get("valor facturado"));
        e.setTotalDeLaOrden(row.get("total de la orden"));
        e.setGanancia(row.get("ganancia"));
        e.setPrecioFlete(row.get("precio flete"));
        e.setCostoDevolucionFlete(row.get("costo devolución flete"));
        e.setComision(row.get("comisión"));
        e.setNovedad(row.get("novedad"));
        e.setFueSolucionadaLaNovedad(row.get("fue solucionada la novedad"));
        e.setHoraDeNovedad(row.get("hora de novedad"));
        e.setFechaDeNovedad(row.get("fecha de novedad"));
        e.setSolucion(row.get("solución"));
        e.setHoraDeSolucion(row.get("hora de solución"));
        e.setFechaDeSolucion(row.get("fecha de solución"));
        e.setObservacion(row.get("observación"));
        e.setHoraDeUltimoMovimiento(row.get("hora de ultimo movimiento"));
        e.setFechaDeUltimoMovimiento(row.get("fecha de ultimo movimiento"));
        e.setUltimoMovimiento(row.get("ultimo movimiento"));
        e.setConceptoUltimoMovimiento(row.get("concepto ultimo movimiento"));
        e.setUbicacionDeUltimoMovimiento(row.get("ubicacion de ultimo movimiento"));
        e.setVendedor(row.get("vendedor"));
        e.setTipoDeTienda(row.get("tipo de tienda"));
        e.setTienda(row.get("tienda"));
        e.setIdDeOrdenDeTienda(row.get("id de orden de tienda"));
        e.setNumeroDePedidoDeTienda(row.get("numero de pedido de tienda"));
        e.setTags(row.get("tags"));
        e.setFechaGeneracionDeGuia(row.get("fecha generacion de guia"));
        e.setUsuarioGeneracionDeGuia(row.get("usuario generacion de guia"));
        e.setCodigoPostal(row.get("código postal"));
        e.setContadorDeIndemnizaciones(row.get("contador de indemnizaciones"));
        e.setConceptoUltimaIndenmizacion(row.get("concepto ultima indemnización"));
        e.setCategorias(row.get("categorias"));
        return e;
    }

    private void failJob(Long jobId, String msg) {
        log.error("{\"action\":\"JOB_FAILED\",\"jobId\":{},\"error\":\"{}\"}", jobId, msg);
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus("ERROR"); j.setErrorMsg(msg); j.setFinishedAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }
}
