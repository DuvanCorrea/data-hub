package com.dropitools.datahub.infrastructure.processor;

import com.dropitools.datahub.application.DropisNormalizationService;
import com.dropitools.datahub.application.DropisNormalizationService.OrdenFields;
import com.dropitools.datahub.domain.model.ImportJob;
import com.dropitools.datahub.domain.port.ImportProcessor;
import com.dropitools.datahub.infrastructure.persistence.entity.*;
import com.dropitools.datahub.infrastructure.persistence.repository.*;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Procesador para DOPI_ORDER_PRODUCT.
 * Fase 1: Excel → stg_dropi_order_product
 * Fase 2: stg → tiendas + vendedores + clientes + ordenes + productos + orden_items
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DropiOrderProductProcessor implements ImportProcessor {

    private static final String TEMPLATE   = "DOPI_ORDER_PRODUCT";
    private static final int    BATCH_SIZE = 100;

    private final DropiExcelReader                  excelReader;
    private final StgDropiOrderProductRepository    stagingRepo;
    private final ImportJobRepository               jobRepo;
    private final EntityManager                     em;
    private final DropisNormalizationService        normService;
    private final ProductoRepository                productoRepo;
    private final OrdenItemRepository               itemRepo;

    @Override
    public boolean supports(String template) { return TEMPLATE.equalsIgnoreCase(template); }

    // ── FASE 1: Excel → stg_dropi_order_product ───────────────────────────────

    @Override
    @Transactional
    public void loadToStaging(ImportJob job, Path filePath) {
        if (!Files.exists(filePath)) { failJob(job.getId(), "Archivo no encontrado: " + filePath); return; }
        log.info("{\"action\":\"STAGING_START\",\"template\":\"DOPI_ORDER_PRODUCT\",\"jobId\":{}}", job.getId());

        List<Map<String, String>> rows;
        try { rows = excelReader.readRows(filePath); }
        catch (IllegalStateException e) { failJob(job.getId(), e.getMessage()); return; }

        List<StgDropiOrderProductEntity> batch = new ArrayList<>(BATCH_SIZE);
        int rowNum = 1;
        for (Map<String, String> row : rows) {
            batch.add(mapRowToStaging(row, job, rowNum++));
            if (batch.size() == BATCH_SIZE) { stagingRepo.saveAll(batch); em.flush(); em.clear(); batch.clear(); }
        }
        if (!batch.isEmpty()) stagingRepo.saveAll(batch);

        ImportJobEntity je = jobRepo.findById(job.getId()).orElseThrow();
        je.setRowsTotal(rows.size());
        jobRepo.save(je);
        log.info("{\"action\":\"STAGING_DONE\",\"template\":\"DOPI_ORDER_PRODUCT\",\"jobId\":{},\"rows\":{}}", job.getId(), rows.size());
    }

    // ── FASE 2: stg → normalización completa ─────────────────────────────────

    @Override
    @Transactional
    public void processStaging(ImportJob job) {
        log.info("{\"action\":\"NORMALIZE_START\",\"template\":\"DOPI_ORDER_PRODUCT\",\"jobId\":{}}", job.getId());
        long errors = 0;

        while (true) {
            List<StgDropiOrderProductEntity> batch = stagingRepo.findByImportJobIdAndProcessingStatus(
                    job.getId(), "PENDING", PageRequest.of(0, BATCH_SIZE));
            if (batch.isEmpty()) break;

            for (StgDropiOrderProductEntity stg : batch) {
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
        log.info("{\"action\":\"NORMALIZE_DONE\",\"template\":\"DOPI_ORDER_PRODUCT\",\"jobId\":{},\"errors\":{}}", job.getId(), errors);
    }

    // ── Normalización de una fila ─────────────────────────────────────────────

    private void normalize(StgDropiOrderProductEntity stg, Long tenantId) {
        // 1-3: lookup tables
        Long tiendaId   = normService.upsertTienda(tenantId, stg.getTienda(), stg.getTipoDeTienda());
        Long vendedorId = normService.upsertVendedor(tenantId, stg.getVendedor(), tiendaId);
        Long clienteId  = normService.upsertCliente(tenantId,
                stg.getNombreCliente(), stg.getTelefono(), stg.getEmail(),
                stg.getTipoDeIdentificacion(), stg.getNroDeIdentificacion());

        // 4: upsert orden con tiene_items = true
        OrdenEntity orden = normService.upsertOrden(tenantId, stg.getIdDropi(), new OrdenFields(
                clienteId, tiendaId, vendedorId,
                stg.getFecha(), stg.getHora(), stg.getFechaDeReporte(), stg.getEstatus(),
                stg.getNumeroGuia(), stg.getTipoDeEnvio(), stg.getTransportadora(),
                stg.getDepartamentoDestino(), stg.getCiudadDestino(), stg.getDireccion(), null,
                DropisNormalizationService.parseMoney(stg.getTotalDeLaOrden()),
                DropisNormalizationService.parseMoney(stg.getGanancia()),
                DropisNormalizationService.parseMoney(stg.getPrecioFlete()),
                DropisNormalizationService.parseMoney(stg.getCostoDevolucionFlete()),
                DropisNormalizationService.parseMoney(stg.getComision()),
                null, null, null, null, null,
                stg.getIdDeOrdenDeTienda(), stg.getNumeroDePedidoDeTienda(), stg.getTags(),
                stg.getFechaGuiaGenerada(),
                stg.getNovedad(), stg.getFueSolucionadaLaNovedad(), stg.getFechaDeNovedad(),
                stg.getSolucion(), stg.getFechaDeSolucion(), stg.getObservacion(),
                stg.getUltimoMovimiento(), stg.getConceptoUltimoMovimiento(),
                stg.getUbicacionDeUltimoMovimiento(), stg.getFechaDeUltimoMovimiento(),
                stg.getContadorDeIndemnizaciones(), stg.getConceptoUltimaIndenmizacion(),
                null
        ), true);

        if (orden == null) return;

        // 5: upsert producto
        Long productoId = upsertProducto(tenantId, stg.getProductoId(), stg.getSku(), stg.getProducto());

        // 6: upsert item (skip si no hay producto_id_dropi)
        if (stg.getProductoId() != null && !stg.getProductoId().isBlank()) {
            upsertItem(orden.getId(), tenantId, productoId, stg);
        }
    }

    private Long upsertProducto(Long tenantId, String productoIdDropi, String sku, String nombre) {
        if (productoIdDropi == null || productoIdDropi.isBlank()) return null;
        return productoRepo.findByTenantIdAndProductoIdDropi(tenantId, productoIdDropi)
                .map(p -> {
                    boolean dirty = false;
                    if (nombre != null && !nombre.isBlank() && (p.getNombre() == null || p.getNombre().isBlank())) {
                        p.setNombre(nombre.trim()); dirty = true;
                    }
                    if (sku != null && !sku.isBlank() && (p.getSku() == null || p.getSku().isBlank())) {
                        p.setSku(sku.trim()); dirty = true;
                    }
                    if (dirty) productoRepo.save(p);
                    return p.getId();
                })
                .orElseGet(() -> {
                    ProductoEntity p = new ProductoEntity();
                    p.setTenantId(tenantId);
                    p.setProductoIdDropi(productoIdDropi.trim());
                    p.setSku(sku != null ? sku.trim() : null);
                    p.setNombre(nombre != null ? nombre.trim() : null);
                    return productoRepo.save(p).getId();
                });
    }

    private void upsertItem(Long ordenId, Long tenantId, Long productoId,
                             StgDropiOrderProductEntity stg) {
        OrdenItemEntity item = itemRepo.findExisting(ordenId, stg.getProductoId(), stg.getVariacionId())
                .orElseGet(OrdenItemEntity::new);

        item.setOrdenId(ordenId);
        item.setTenantId(tenantId);
        item.setProductoId(productoId);
        item.setProductoIdDropi(stg.getProductoId());
        item.setSku(stg.getSku());
        item.setVariacionIdDropi(stg.getVariacionId());
        item.setNombreProducto(stg.getProducto());
        item.setNombreVariacion(stg.getVariacion());
        item.setCantidad(DropisNormalizationService.parseInt(stg.getCantidad()));
        item.setPrecioProveedor(parseMoney(stg.getPrecioProveedor()));
        item.setPrecioProveedorXCantidad(parseMoney(stg.getPrecioProveedorXCantidad()));
        item.setPorcentajeComisionPlataforma(parseMoney(stg.getPorcentajeComisionPlataforma()));
        itemRepo.save(item);
    }

    private BigDecimal parseMoney(String raw) { return DropisNormalizationService.parseMoney(raw); }

    // ── Mapeo Excel → staging ─────────────────────────────────────────────────

    private StgDropiOrderProductEntity mapRowToStaging(Map<String, String> row, ImportJob job, int rowNum) {
        StgDropiOrderProductEntity e = new StgDropiOrderProductEntity();
        e.setImportJobId(job.getId()); e.setTenantId(job.getTenantId()); e.setRowNumber(rowNum);
        e.setFechaDeReporte(row.get("fecha de reporte"));
        e.setIdDropi(row.get("id"));
        e.setHora(row.get("hora"));
        e.setFecha(row.get("fecha"));
        e.setNombreCliente(row.get("nombre cliente"));
        e.setTelefono(row.get("teléfono"));
        e.setEmail(row.get("email"));
        e.setTipoDeIdentificacion(row.get("tipo de identificacion"));
        e.setNroDeIdentificacion(row.get("nro de identificacion"));
        e.setNumeroGuia(row.get("número guia"));
        e.setEstatus(row.get("estatus"));
        e.setTipoDeEnvio(row.get("tipo de envio"));
        e.setDepartamentoDestino(row.get("departamento destino"));
        e.setCiudadDestino(row.get("ciudad destino"));
        e.setDireccion(row.get("direccion"));
        e.setNotas(row.get("notas"));
        e.setTransportadora(row.get("transportadora"));
        e.setTotalDeLaOrden(row.get("total de la orden"));
        e.setGanancia(row.get("ganancia"));
        e.setPrecioFlete(row.get("precio flete"));
        e.setCostoDevolucionFlete(row.get("costo devolucion flete"));
        e.setComision(row.get("comision"));
        e.setPorcentajeComisionPlataforma(row.get("% comision de la plataformma"));
        e.setPrecioProveedor(row.get("precio proveedor"));
        e.setPrecioProveedorXCantidad(row.get("precio proveedor x cantidad"));
        e.setProductoId(row.get("producto id"));
        e.setSku(row.get("sku"));
        e.setVariacionId(row.get("variacion id"));
        e.setProducto(row.get("producto"));
        e.setVariacion(row.get("variacion"));
        e.setCantidad(row.get("cantidad"));
        e.setNovedad(row.get("novedad"));
        e.setFueSolucionadaLaNovedad(row.get("fue solucionada la novedad"));
        e.setHoraDeNovedad(row.get("hora de novedad"));
        e.setFechaDeNovedad(row.get("fecha de novedad"));
        e.setSolucion(row.get("solución"));
        e.setHoraDeSolucion(row.get("hora de solución"));
        e.setFechaDeSolucion(row.get("fecha de solución"));
        e.setObservacion(row.get("observación"));
        e.setHoraDeUltimoMovimiento(row.get("hora de último movimiento"));
        e.setFechaDeUltimoMovimiento(row.get("fecha de último movimiento"));
        e.setUltimoMovimiento(row.get("último movimiento"));
        e.setConceptoUltimoMovimiento(row.get("concepto último movimiento"));
        e.setUbicacionDeUltimoMovimiento(row.get("ubicación de último movimiento"));
        e.setVendedor(row.get("vendedor"));
        e.setTipoDeTienda(row.get("tipo de tienda"));
        e.setTienda(row.get("tienda"));
        e.setIdDeOrdenDeTienda(row.get("id de orden de tienda"));
        e.setNumeroDePedidoDeTienda(row.get("numero de pedido de tienda"));
        e.setTags(row.get("tags"));
        e.setFechaGuiaGenerada(row.get("fecha guia generada"));
        e.setContadorDeIndemnizaciones(row.get("contador de indemnizaciones"));
        e.setConceptoUltimaIndenmizacion(row.get("concepto última indenmización"));
        return e;
    }

    private void failJob(Long jobId, String msg) {
        log.error("{\"action\":\"JOB_FAILED\",\"template\":\"DOPI_ORDER_PRODUCT\",\"jobId\":{},\"error\":\"{}\"}", jobId, msg);
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus("ERROR"); j.setErrorMsg(msg); j.setFinishedAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }
}
