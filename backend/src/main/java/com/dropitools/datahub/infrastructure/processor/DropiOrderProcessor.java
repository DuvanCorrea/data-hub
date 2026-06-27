package com.dropitools.datahub.infrastructure.processor;

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

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Procesador concreto para la plantilla DROPI_ORDER.
 * Implementa las dos fases del ImportProcessor:
 *   1. loadToStaging  → Excel → stg_dropi_order
 *   2. processStaging → stg_dropi_order → UPSERT en pedidos
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DropiOrderProcessor implements ImportProcessor {

    private static final String TEMPLATE = "DROPI_ORDER";
    private static final int BATCH_SIZE = 100;

    private final DropiExcelReader excelReader;
    private final StgDropiOrderRepository stagingRepo;
    private final ImportJobRepository jobRepo;
    private final EntityManager em;

    @Override
    public boolean supports(String template) {
        return TEMPLATE.equalsIgnoreCase(template);
    }

    // ── FASE 1: Excel → Staging ────────────────────────────────────────────

    @Override
    @Transactional
    public void loadToStaging(ImportJob job, Path filePath) {
        if (!Files.exists(filePath)) {
            failJob(job.getId(), "Archivo no encontrado en almacenamiento: " + filePath);
            return;
        }

        log.info("{\"action\":\"STAGING_START\",\"jobId\":{},\"file\":\"{}\"}", job.getId(), filePath.getFileName());

        List<Map<String, String>> rows;
        try {
            rows = excelReader.readRows(filePath);
        } catch (IllegalStateException e) {
            failJob(job.getId(), e.getMessage());
            return;
        }

        List<StgDropiOrderEntity> batch = new ArrayList<>(BATCH_SIZE);
        int rowNum = 1;

        for (Map<String, String> row : rows) {
            StgDropiOrderEntity stg = mapRowToStaging(row, job, rowNum++);
            batch.add(stg);

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

        // Actualizar rowsTotal en el job
        ImportJobEntity jobEntity = jobRepo.findById(job.getId()).orElseThrow();
        jobEntity.setRowsTotal(rows.size());
        jobRepo.save(jobEntity);

        log.info("{\"action\":\"STAGING_DONE\",\"jobId\":{},\"rowsTotal\":{}}", job.getId(), rows.size());
    }

    // ── FASE 2: Staging → UPSERT pedidos ──────────────────────────────────

    @Override
    @Transactional
    public void processStaging(ImportJob job) {
        log.info("{\"action\":\"PROCESS_START\",\"jobId\":{}}", job.getId());
        int page = 0;
        long errorCount = 0;

        while (true) {
            List<StgDropiOrderEntity> batch = stagingRepo.findByImportJobIdAndProcessingStatus(
                    job.getId(), "PENDING", PageRequest.of(page, BATCH_SIZE));

            if (batch.isEmpty()) break;

            for (StgDropiOrderEntity stg : batch) {
                try {
                    upsertPedido(stg, job);
                    stg.setProcessingStatus("PROCESSED");
                    stg.setProcessedAt(OffsetDateTime.now());
                } catch (Exception e) {
                    stg.setProcessingStatus("ERROR");
                    stg.setErrorDetail(e.getMessage());
                    errorCount++;
                }
            }
            stagingRepo.saveAll(batch);

            // Actualizar rows_done en el job con el progreso real
            long done = stagingRepo.countByImportJobIdAndProcessingStatus(job.getId(), "PROCESSED");
            ImportJobEntity jobEntity = jobRepo.findById(job.getId()).orElseThrow();
            jobEntity.setRowsDone((int) done);
            jobRepo.save(jobEntity);

            // Siguiente página (siempre página 0 porque ya los marcamos PROCESSED)
        }

        // Marcar job COMPLETED
        ImportJobEntity jobEntity = jobRepo.findById(job.getId()).orElseThrow();
        jobEntity.setStatus("COMPLETED");
        jobEntity.setFinishedAt(OffsetDateTime.now());
        jobRepo.save(jobEntity);

        log.info("{\"action\":\"JOB_COMPLETED\",\"tenantId\":{},\"jobId\":{},\"rowsDone\":{},\"errors\":{}}",
                job.getTenantId(), job.getId(), jobEntity.getRowsDone(), errorCount);
    }

    // ── Helpers privados ──────────────────────────────────────────────────

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

    /**
     * UPSERT nativo: inserta o actualiza un pedido según (tenant_id, dropi_id).
     */
    private void upsertPedido(StgDropiOrderEntity stg, ImportJob job) {
        if (stg.getIdDropi() == null || stg.getIdDropi().isBlank()) {
            throw new IllegalArgumentException("dropi_id vacío en fila " + stg.getRowNumber());
        }

        LocalDate fecha = parseDate(stg.getFecha());
        BigDecimal totalOrden = parseMoney(stg.getTotalDeLaOrden());
        BigDecimal ganancia = parseMoney(stg.getGanancia());
        BigDecimal precioFlete = parseMoney(stg.getPrecioFlete());

        em.createNativeQuery("""
                INSERT INTO pedidos (
                    tenant_id, dropi_id, fecha, nombre_cliente, telefono, email,
                    numero_guia, estatus, tipo_de_envio, departamento, ciudad, direccion,
                    notas, transportadora, total_orden, ganancia, precio_flete,
                    vendedor, tienda, tags, categorias, novedad, ultimo_movimiento,
                    created_at, updated_at
                ) VALUES (
                    :tenantId, :dropiId, :fecha, :nombreCliente, :telefono, :email,
                    :numeroGuia, :estatus, :tipoDeEnvio, :departamento, :ciudad, :direccion,
                    :notas, :transportadora, :totalOrden, :ganancia, :precioFlete,
                    :vendedor, :tienda, :tags, :categorias, :novedad, :ultimoMovimiento,
                    NOW(), NOW()
                )
                ON CONFLICT (tenant_id, dropi_id) DO UPDATE SET
                    fecha             = EXCLUDED.fecha,
                    estatus           = EXCLUDED.estatus,
                    numero_guia       = EXCLUDED.numero_guia,
                    total_orden       = EXCLUDED.total_orden,
                    ganancia          = EXCLUDED.ganancia,
                    precio_flete      = EXCLUDED.precio_flete,
                    nombre_cliente    = EXCLUDED.nombre_cliente,
                    telefono          = EXCLUDED.telefono,
                    departamento      = EXCLUDED.departamento,
                    ciudad            = EXCLUDED.ciudad,
                    direccion         = EXCLUDED.direccion,
                    transportadora    = EXCLUDED.transportadora,
                    vendedor          = EXCLUDED.vendedor,
                    tienda            = EXCLUDED.tienda,
                    novedad           = EXCLUDED.novedad,
                    ultimo_movimiento = EXCLUDED.ultimo_movimiento,
                    updated_at        = NOW()
                """)
                .setParameter("tenantId", job.getTenantId())
                .setParameter("dropiId", stg.getIdDropi())
                .setParameter("fecha", fecha)
                .setParameter("nombreCliente", stg.getNombreCliente())
                .setParameter("telefono", stg.getTelefono())
                .setParameter("email", stg.getEmail())
                .setParameter("numeroGuia", stg.getNumeroGuia())
                .setParameter("estatus", stg.getEstatus())
                .setParameter("tipoDeEnvio", stg.getTipoDeEnvio())
                .setParameter("departamento", stg.getDepartamentoDestino())
                .setParameter("ciudad", stg.getCiudadDestino())
                .setParameter("direccion", stg.getDireccion())
                .setParameter("notas", stg.getNotas())
                .setParameter("transportadora", stg.getTransportadora())
                .setParameter("totalOrden", totalOrden)
                .setParameter("ganancia", ganancia)
                .setParameter("precioFlete", precioFlete)
                .setParameter("vendedor", stg.getVendedor())
                .setParameter("tienda", stg.getTienda())
                .setParameter("tags", stg.getTags())
                .setParameter("categorias", stg.getCategorias())
                .setParameter("novedad", stg.getNovedad())
                .setParameter("ultimoMovimiento", stg.getUltimoMovimiento())
                .executeUpdate();
    }

    private LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        // Intentar varios formatos comunes del Excel de Dropi
        for (String pattern : List.of("yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd", "dd/MM/yyyy", "MM/dd/yyyy")) {
            try {
                return LocalDate.parse(raw.strip().substring(0, Math.min(raw.length(), 10)),
                        DateTimeFormatter.ofPattern(pattern.substring(0, 10)));
            } catch (DateTimeParseException ignored) {
            }
        }
        return null;
    }

    private BigDecimal parseMoney(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            // Dropi usa coma como separador de miles: "1,234.56" → "1234.56"
            return new BigDecimal(raw.replace(",", "").replace("$", "").trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private void failJob(Long jobId, String errorMsg) {
        log.error("{\"action\":\"JOB_FAILED\",\"jobId\":{},\"error\":\"{}\"}", jobId, errorMsg);
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus("ERROR");
            j.setErrorMsg(errorMsg);
            j.setFinishedAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }
}
