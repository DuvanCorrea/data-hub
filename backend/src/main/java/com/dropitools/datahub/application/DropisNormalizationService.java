package com.dropitools.datahub.application;

import com.dropitools.datahub.infrastructure.persistence.entity.*;
import com.dropitools.datahub.infrastructure.persistence.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * Servicio compartido de normalización: convierte datos crudos de staging
 * en las tablas relacionales destino (tiendas, vendedores, clientes, ordenes).
 *
 * Usado por DropiOrderProcessor y DropiOrderProductProcessor.
 * Cada método retorna el ID del registro upsertado/encontrado.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DropisNormalizationService {

    private final TiendaRepository   tiendaRepo;
    private final VendedorRepository  vendedorRepo;
    private final ClienteRepository   clienteRepo;
    private final OrdenRepository     ordenRepo;

    // ── Tienda ─────────────────────────────────────────────────────────────────

    @Transactional(propagation = Propagation.REQUIRED)
    public Long upsertTienda(Long tenantId, String nombre, String tipo) {
        if (isBlank(nombre)) return null;
        return tiendaRepo.findByTenantIdAndNombre(tenantId, nombre)
                .map(t -> {
                    if (!eq(t.getTipo(), tipo)) { t.setTipo(tipo); tiendaRepo.save(t); }
                    return t.getId();
                })
                .orElseGet(() -> {
                    TiendaEntity t = new TiendaEntity();
                    t.setTenantId(tenantId);
                    t.setNombre(nombre);
                    t.setTipo(tipo);
                    return tiendaRepo.save(t).getId();
                });
    }

    // ── Vendedor ───────────────────────────────────────────────────────────────

    @Transactional(propagation = Propagation.REQUIRED)
    public Long upsertVendedor(Long tenantId, String nombre, Long tiendaId) {
        if (isBlank(nombre)) return null;
        return vendedorRepo.findByTenantIdAndNombre(tenantId, nombre)
                .map(v -> {
                    if (tiendaId != null && !tiendaId.equals(v.getTiendaId())) {
                        v.setTiendaId(tiendaId);
                        vendedorRepo.save(v);
                    }
                    return v.getId();
                })
                .orElseGet(() -> {
                    VendedorEntity v = new VendedorEntity();
                    v.setTenantId(tenantId);
                    v.setNombre(nombre);
                    v.setTiendaId(tiendaId);
                    return vendedorRepo.save(v).getId();
                });
    }

    // ── Cliente ────────────────────────────────────────────────────────────────

    @Transactional(propagation = Propagation.REQUIRED)
    public Long upsertCliente(Long tenantId, String nombre, String telefono,
                               String email, String tipoId, String nroId) {
        if (!isBlank(telefono)) {
            return clienteRepo.findByTenantIdAndTelefono(tenantId, telefono.trim())
                    .map(c -> {
                        // Enriquecer si faltan datos
                        boolean dirty = false;
                        if (isBlank(c.getNombre())  && !isBlank(nombre))  { c.setNombre(nombre.trim());  dirty = true; }
                        if (isBlank(c.getEmail())   && !isBlank(email))   { c.setEmail(email.trim());    dirty = true; }
                        if (isBlank(c.getNroIdentificacion()) && !isBlank(nroId)) {
                            c.setTipoIdentificacion(tipoId);
                            c.setNroIdentificacion(nroId);
                            dirty = true;
                        }
                        if (dirty) clienteRepo.save(c);
                        return c.getId();
                    })
                    .orElseGet(() -> createCliente(tenantId, nombre, telefono, email, tipoId, nroId));
        }
        // Sin teléfono: siempre crear (no hay clave de deduplicación confiable)
        return createCliente(tenantId, nombre, telefono, email, tipoId, nroId);
    }

    private Long createCliente(Long tenantId, String nombre, String telefono,
                                String email, String tipoId, String nroId) {
        ClienteEntity c = new ClienteEntity();
        c.setTenantId(tenantId);
        c.setNombre(trim(nombre));
        c.setTelefono(trim(telefono));
        c.setEmail(trim(email));
        c.setTipoIdentificacion(trim(tipoId));
        c.setNroIdentificacion(trim(nroId));
        return clienteRepo.save(c).getId();
    }

    // ── Orden (upsert base — sin items) ───────────────────────────────────────

    @Transactional(propagation = Propagation.REQUIRED)
    public OrdenEntity upsertOrden(Long tenantId, String dropiId,
                                    OrdenFields f, boolean marcarConItems) {
        if (isBlank(dropiId)) return null;
        return ordenRepo.findByTenantIdAndDropiId(tenantId, dropiId)
                .map(o -> {
                    applyFields(o, f);
                    if (marcarConItems) o.setTieneItems(true);
                    return ordenRepo.save(o);
                })
                .orElseGet(() -> {
                    OrdenEntity o = new OrdenEntity();
                    o.setTenantId(tenantId);
                    o.setDropiId(dropiId);
                    o.setTieneItems(marcarConItems);
                    applyFields(o, f);
                    return ordenRepo.save(o);
                });
    }

    // ── DTO de campos planos ───────────────────────────────────────────────────

    /** Holder de campos de la orden (evita métodos con 30 parámetros) */
    public record OrdenFields(
            Long clienteId, Long tiendaId, Long vendedorId,
            String fechaRaw, String hora, String fechaReporte, String estatus,
            String numeroGuia, String tipoEnvio, String transportadora,
            String departamento, String ciudad, String direccion, String codigoPostal,
            BigDecimal totalOrden, BigDecimal ganancia, BigDecimal precioFlete,
            BigDecimal costoDevolucionFlete, BigDecimal comision,
            String numeroFactura, BigDecimal valorFacturado,
            String ordenDropshipper, String usuarioGeneracionGuia, String categorias,
            String idOrdenTienda, String numeroPedidoTienda, String tags,
            String fechaGuiaGenerada,
            String novedad, String fueSolucionadaNovedad, String fechaNovedad,
            String solucion, String fechaSolucion, String observacion,
            String ultimoMovimiento, String conceptoUltimoMovimiento,
            String ubicacionUltimoMovimiento, String fechaUltimoMovimiento,
            String contadorIndemnizaciones, String conceptoUltimaIndenmizacion,
            String notas
    ) {}

    private void applyFields(OrdenEntity o, OrdenFields f) {
        if (f.clienteId()  != null) o.setClienteId(f.clienteId());
        if (f.tiendaId()   != null) o.setTiendaId(f.tiendaId());
        if (f.vendedorId() != null) o.setVendedorId(f.vendedorId());

        o.setFecha(parseDate(f.fechaRaw()));
        o.setHora(trim(f.hora()));
        o.setFechaReporte(trim(f.fechaReporte()));
        o.setEstatus(trim(f.estatus()));
        o.setNumeroGuia(trim(f.numeroGuia()));
        o.setTipoEnvio(trim(f.tipoEnvio()));
        o.setTransportadora(trim(f.transportadora()));
        o.setDepartamentoDestino(trim(f.departamento()));
        o.setCiudadDestino(trim(f.ciudad()));
        o.setDireccion(trim(f.direccion()));
        o.setCodigoPostal(trim(f.codigoPostal()));
        if (f.totalOrden()           != null) o.setTotalOrden(f.totalOrden());
        if (f.ganancia()             != null) o.setGanancia(f.ganancia());
        if (f.precioFlete()          != null) o.setPrecioFlete(f.precioFlete());
        if (f.costoDevolucionFlete() != null) o.setCostoDevolucionFlete(f.costoDevolucionFlete());
        if (f.comision()             != null) o.setComision(f.comision());
        if (!isBlank(f.numeroFactura()))      o.setNumeroFactura(trim(f.numeroFactura()));
        if (f.valorFacturado()       != null) o.setValorFacturado(f.valorFacturado());
        if (!isBlank(f.ordenDropshipper()))   o.setOrdenDropshipper(trim(f.ordenDropshipper()));
        if (!isBlank(f.usuarioGeneracionGuia())) o.setUsuarioGeneracionGuia(trim(f.usuarioGeneracionGuia()));
        if (!isBlank(f.categorias()))         o.setCategorias(trim(f.categorias()));
        o.setIdOrdenTienda(trim(f.idOrdenTienda()));
        o.setNumeroPedidoTienda(trim(f.numeroPedidoTienda()));
        o.setTags(trim(f.tags()));
        o.setFechaGuiaGenerada(trim(f.fechaGuiaGenerada()));
        o.setNovedad(trim(f.novedad()));
        o.setFueSolucionadaNovedad(trim(f.fueSolucionadaNovedad()));
        o.setFechaNovedad(trim(f.fechaNovedad()));
        o.setSolucion(trim(f.solucion()));
        o.setFechaSolucion(trim(f.fechaSolucion()));
        o.setObservacion(trim(f.observacion()));
        o.setUltimoMovimiento(trim(f.ultimoMovimiento()));
        o.setConceptoUltimoMovimiento(trim(f.conceptoUltimoMovimiento()));
        o.setUbicacionUltimoMovimiento(trim(f.ubicacionUltimoMovimiento()));
        o.setFechaUltimoMovimiento(trim(f.fechaUltimoMovimiento()));
        o.setContadorIndemnizaciones(trim(f.contadorIndemnizaciones()));
        o.setConceptoUltimaIndenmizacion(trim(f.conceptoUltimaIndenmizacion()));
        o.setNotas(trim(f.notas()));
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    public static LocalDate parseDate(String raw) {
        if (isBlank(raw)) return null;
        for (String pattern : List.of("yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd", "dd/MM/yyyy",
                                       "MM/dd/yyyy", "dd-MM-yyyy")) {
            try {
                String s = raw.strip();
                if (pattern.contains("HH")) {
                    return LocalDate.parse(s.substring(0, Math.min(s.length(), 10)),
                            DateTimeFormatter.ofPattern("yyyy-MM-dd"));
                }
                return LocalDate.parse(s.substring(0, Math.min(s.length(), 10)),
                        DateTimeFormatter.ofPattern(pattern.substring(0, 10)));
            } catch (DateTimeParseException ignored) {}
        }
        return null;
    }

    public static BigDecimal parseMoney(String raw) {
        if (isBlank(raw)) return null;
        try {
            return new BigDecimal(raw.replace(",", ".").replace("$", "").replace(" ", "").trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static Integer parseInt(String raw) {
        if (isBlank(raw)) return null;
        try { return Integer.parseInt(raw.trim()); } catch (NumberFormatException e) { return null; }
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }
    private static boolean eq(String a, String b) { return java.util.Objects.equals(a, b); }
    private static String  trim(String s)         { return (s == null || s.isBlank()) ? null : s.trim(); }
}
