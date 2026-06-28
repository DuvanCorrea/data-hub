package com.dropitools.datahub.application;

import com.dropitools.datahub.infrastructure.persistence.entity.*;
import com.dropitools.datahub.infrastructure.persistence.repository.*;
import com.dropitools.datahub.infrastructure.rest.dto.dropi.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Queries de lectura para el módulo Dropi (órdenes, clientes, productos, stats).
 * Sin lógica de escritura — eso está en DropisNormalizationService y los processors.
 */
@Service
@RequiredArgsConstructor
public class DropisQueryService {

    private final OrdenRepository    ordenRepo;
    private final ClienteRepository  clienteRepo;
    private final ProductoRepository productoRepo;
    private final OrdenItemRepository itemRepo;
    private final TiendaRepository   tiendaRepo;

    // ── Órdenes ───────────────────────────────────────────────────────────────

    public Page<OrdenListDto> listOrdenes(Long tenantId,
                                           String estatus, String ciudad, Long tiendaId,
                                           LocalDate fechaDesde, LocalDate fechaHasta,
                                           int page, int size, String sortBy, String sortDir) {
        Sort sort = Sort.by("desc".equalsIgnoreCase(sortDir) ? Sort.Direction.DESC : Sort.Direction.ASC,
                safeSortField(sortBy));
        Pageable pageable = PageRequest.of(page, Math.min(size, 200), sort);

        Page<OrdenEntity> ordenes = ordenRepo.findFiltered(tenantId,
                blankToNull(estatus), blankToNull(ciudad), tiendaId,
                fechaDesde, fechaHasta, pageable);

        // Batch-fetch clientes, tiendas y costo proveedor para evitar N+1
        Set<Long> clienteIds = ordenes.stream()
                .filter(o -> o.getClienteId() != null).map(OrdenEntity::getClienteId)
                .collect(Collectors.toSet());
        Set<Long> tiendaIds = ordenes.stream()
                .filter(o -> o.getTiendaId() != null).map(OrdenEntity::getTiendaId)
                .collect(Collectors.toSet());
        Set<Long> ordenIds = ordenes.stream().map(OrdenEntity::getId).collect(Collectors.toSet());

        Map<Long, ClienteEntity> clientes = clienteRepo.findAllById(clienteIds).stream()
                .collect(Collectors.toMap(ClienteEntity::getId, Function.identity()));
        Map<Long, TiendaEntity>  tiendas  = tiendaRepo.findAllById(tiendaIds).stream()
                .collect(Collectors.toMap(TiendaEntity::getId, Function.identity()));

        // Costo proveedor total por orden (una query batch)
        Map<Long, java.math.BigDecimal> costoMap = itemRepo.sumCostoByOrdenIds(ordenIds)
                .stream().collect(Collectors.toMap(
                        r -> toLong(r[0]),
                        r -> toBD(r[1])
                ));

        return ordenes.map(o -> toListDto(o, clientes, tiendas, costoMap));
    }

    public OrdenDetalleDto getDetalle(Long tenantId, Long ordenId) {
        OrdenEntity orden = ordenRepo.findById(ordenId)
                .filter(o -> o.getTenantId().equals(tenantId))
                .orElseThrow(() -> new IllegalArgumentException("Orden no encontrada"));

        ClienteDto cliente = orden.getClienteId() != null
                ? clienteRepo.findById(orden.getClienteId()).map(this::toClienteDto).orElse(null)
                : null;

        List<OrdenItemDto> items = itemRepo.findByOrdenId(ordenId)
                .stream().map(this::toItemDto).collect(Collectors.toList());

        // Obtener nombres de tienda/vendedor
        String tiendaNombre  = orden.getTiendaId()   != null ? tiendaRepo.findById(orden.getTiendaId()).map(TiendaEntity::getNombre).orElse(null) : null;

        return OrdenDetalleDto.builder()
                .id(orden.getId()).dropiId(orden.getDropiId())
                .fecha(orden.getFecha()).hora(orden.getHora())
                .fechaReporte(orden.getFechaReporte()).estatus(orden.getEstatus())
                .numeroGuia(orden.getNumeroGuia()).tipoEnvio(orden.getTipoEnvio())
                .transportadora(orden.getTransportadora())
                .departamentoDestino(orden.getDepartamentoDestino())
                .ciudadDestino(orden.getCiudadDestino()).direccion(orden.getDireccion())
                .codigoPostal(orden.getCodigoPostal())
                .totalOrden(orden.getTotalOrden()).ganancia(orden.getGanancia())
                .precioFlete(orden.getPrecioFlete())
                .costoDevolucionFlete(orden.getCostoDevolucionFlete())
                .comision(orden.getComision())
                .numeroFactura(orden.getNumeroFactura()).valorFacturado(orden.getValorFacturado())
                .ordenDropshipper(orden.getOrdenDropshipper())
                .tienda(tiendaNombre).idOrdenTienda(orden.getIdOrdenTienda())
                .numeroPedidoTienda(orden.getNumeroPedidoTienda())
                .tags(orden.getTags()).categorias(orden.getCategorias())
                .fechaGuiaGenerada(orden.getFechaGuiaGenerada())
                .novedad(orden.getNovedad())
                .fueSolucionadaNovedad(orden.getFueSolucionadaNovedad())
                .solucion(orden.getSolucion()).observacion(orden.getObservacion())
                .ultimoMovimiento(orden.getUltimoMovimiento())
                .conceptoUltimoMovimiento(orden.getConceptoUltimoMovimiento())
                .ubicacionUltimoMovimiento(orden.getUbicacionUltimoMovimiento())
                .fechaUltimoMovimiento(orden.getFechaUltimoMovimiento())
                .contadorIndemnizaciones(orden.getContadorIndemnizaciones())
                .conceptoUltimaIndenmizacion(orden.getConceptoUltimaIndenmizacion())
                .cliente(cliente).items(items)
                .createdAt(orden.getCreatedAt()).updatedAt(orden.getUpdatedAt())
                .build();
    }

    // ── Clientes ──────────────────────────────────────────────────────────────

    public Page<ClienteDto> listClientes(Long tenantId, String q, int page, int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 200), Sort.by("nombre"));
        Page<ClienteEntity> raw = (q != null && !q.isBlank())
                ? clienteRepo.search(tenantId, q.trim(), pageable)
                : clienteRepo.findByTenantId(tenantId, pageable);
        return raw.map(this::toClienteDto);
    }

    // ── Productos ─────────────────────────────────────────────────────────────

    public Page<ProductoDto> listProductos(Long tenantId, int page, int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 200));
        return productoRepo.findByTenantId(tenantId, pageable).map(p -> ProductoDto.builder()
                .id(p.getId()).productoIdDropi(p.getProductoIdDropi())
                .sku(p.getSku()).nombre(p.getNombre())
                .qtyTotal(0L).ordenesCount(0L)   // enriquecido por top-productos si se necesita
                .createdAt(p.getCreatedAt()).build());
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    public DropisStatsDto getStats(Long tenantId) {
        // KPIs tienda — la query devuelve UNA fila; acceder via .get(0)
        List<Object[]> kpiRows = ordenRepo.kpis(tenantId);
        Object[] kpiRow = kpiRows.isEmpty() ? new Object[]{0L, 0, 0, 0L, 0} : kpiRows.get(0);
        long totalOrdenes     = toLong(kpiRow[0]);
        BigDecimal ganancia   = toBD(kpiRow[1]);
        BigDecimal venta      = toBD(kpiRow[2]);
        long entregadas       = toLong(kpiRow[3]);
        BigDecimal flete      = toBD(kpiRow[4]);
        BigDecimal tasa = totalOrdenes > 0
                ? BigDecimal.valueOf(entregadas * 100.0 / totalOrdenes).setScale(1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // KPIs bodega — ídem
        List<Object[]> bodegaRows = itemRepo.kpiBodega(tenantId);
        Object[] bodegaRow = bodegaRows.isEmpty() ? new Object[]{0, 0, 0L} : bodegaRows.get(0);
        long unidades        = toLong(bodegaRow[0]);
        BigDecimal costoProv = toBD(bodegaRow[1]);
        long ordenesConItems = toLong(bodegaRow[2]);

        // Distribuciones
        List<DropisStatsDto.EstatusCount> porEstatus = ordenRepo.countByEstatus(tenantId)
                .stream().map(r -> DropisStatsDto.EstatusCount.builder()
                        .estatus((String) r[0]).count(toLong(r[1])).montoTotal(toBD(r[2])).build())
                .collect(Collectors.toList());

        List<DropisStatsDto.CiudadCount> topCiudades = ordenRepo.topCiudades(tenantId)
                .stream().map(r -> DropisStatsDto.CiudadCount.builder()
                        .ciudad((String) r[0]).count(toLong(r[1])).montoTotal(toBD(r[2])).build())
                .collect(Collectors.toList());

        List<DropisStatsDto.MesCount> evolucion = ordenRepo.evolucionMensual(tenantId)
                .stream().map(r -> DropisStatsDto.MesCount.builder()
                        .anio(toInt(r[0])).mes(toInt(r[1])).count(toLong(r[2])).gananciaTotal(toBD(r[3])).build())
                .collect(Collectors.toList());

        List<DropisStatsDto.ProductoCount> topProductos = productoRepo.topProductos(tenantId)
                .stream().map(r -> DropisStatsDto.ProductoCount.builder()
                        .nombre((String) r[0]).sku((String) r[1])
                        .qtyTotal(toLong(r[3])).ordenesCount(toLong(r[4])).build())
                .collect(Collectors.toList());

        return DropisStatsDto.builder()
                .totalOrdenes(totalOrdenes).ventaTotal(venta).gananciaTotal(ganancia)
                .ordenesEntregadas(entregadas).tasaEntrega(tasa).fleteTotal(flete)
                .unidadesTotal(unidades).costoProveedorTotal(costoProv).ordenesConItems(ordenesConItems)
                .porEstatus(porEstatus).topCiudades(topCiudades)
                .evolucion(evolucion).topProductos(topProductos)
                .build();
    }

    // ── Mappers privados ──────────────────────────────────────────────────────

    private OrdenListDto toListDto(OrdenEntity o,
                                    Map<Long, ClienteEntity> clientes,
                                    Map<Long, TiendaEntity>  tiendas,
                                    Map<Long, java.math.BigDecimal> costoMap) {
        ClienteEntity c = o.getClienteId() != null ? clientes.get(o.getClienteId()) : null;
        TiendaEntity  t = o.getTiendaId()   != null ? tiendas.get(o.getTiendaId())   : null;
        return OrdenListDto.builder()
                .id(o.getId()).dropiId(o.getDropiId()).fecha(o.getFecha())
                .estatus(o.getEstatus())
                .nombreCliente(c != null ? c.getNombre()   : null)
                .telefono(      c != null ? c.getTelefono() : null)
                .ciudadDestino(o.getCiudadDestino()).departamentoDestino(o.getDepartamentoDestino())
                .transportadora(o.getTransportadora()).numeroGuia(o.getNumeroGuia())
                .totalOrden(o.getTotalOrden()).ganancia(o.getGanancia()).precioFlete(o.getPrecioFlete())
                .tienda(t != null ? t.getNombre() : null)
                .costoProveedorTotal(costoMap.getOrDefault(o.getId(), java.math.BigDecimal.ZERO))
                .tieneItems(o.getTieneItems()).createdAt(o.getCreatedAt()).build();
    }

    private ClienteDto toClienteDto(ClienteEntity c) {
        return ClienteDto.builder().id(c.getId()).nombre(c.getNombre())
                .telefono(c.getTelefono()).email(c.getEmail())
                .tipoIdentificacion(c.getTipoIdentificacion())
                .nroIdentificacion(c.getNroIdentificacion())
                .createdAt(c.getCreatedAt()).build();
    }

    private OrdenItemDto toItemDto(OrdenItemEntity i) {
        return OrdenItemDto.builder().id(i.getId())
                .productoIdDropi(i.getProductoIdDropi()).sku(i.getSku())
                .variacionIdDropi(i.getVariacionIdDropi())
                .nombreProducto(i.getNombreProducto()).nombreVariacion(i.getNombreVariacion())
                .cantidad(i.getCantidad()).precioProveedor(i.getPrecioProveedor())
                .precioProveedorXCantidad(i.getPrecioProveedorXCantidad())
                .porcentajeComisionPlataforma(i.getPorcentajeComisionPlataforma())
                .createdAt(i.getCreatedAt()).build();
    }

    // ── Type coercion helpers ─────────────────────────────────────────────────

    private static long toLong(Object o) {
        if (o == null) return 0L;
        if (o instanceof Number n) return n.longValue();
        return Long.parseLong(o.toString());
    }

    private static int toInt(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.intValue();
        return Integer.parseInt(o.toString());
    }

    private static BigDecimal toBD(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal bd) return bd;
        if (o instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        try { return new BigDecimal(o.toString()); } catch (Exception e) { return BigDecimal.ZERO; }
    }

    private static String blankToNull(String s) { return (s == null || s.isBlank()) ? null : s.trim(); }

    private static String safeSortField(String field) {
        return java.util.Set.of("id","fecha","estatus","totalOrden","ganancia","ciudadDestino","createdAt")
                .contains(field) ? field : "fecha";
    }
}
