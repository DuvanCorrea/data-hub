package com.dropitools.datahub.infrastructure.rest;

import com.dropitools.datahub.application.DropisQueryService;
import com.dropitools.datahub.infrastructure.rest.dto.ApiResponse;
import com.dropitools.datahub.infrastructure.rest.dto.dropi.OrdenDetalleDto;
import com.dropitools.datahub.infrastructure.rest.dto.dropi.OrdenListDto;
import com.dropitools.datahub.infrastructure.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/dropi/ordenes")
@RequiredArgsConstructor
public class DropisOrdenController {

    private final DropisQueryService queryService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<OrdenListDto>>> list(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) String estatus,
            @RequestParam(required = false) String ciudad,
            @RequestParam(required = false) Long tiendaId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fechaDesde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fechaHasta,
            @RequestParam(defaultValue = "0")      int    page,
            @RequestParam(defaultValue = "50")     int    size,
            @RequestParam(defaultValue = "fecha")  String sortBy,
            @RequestParam(defaultValue = "desc")   String sortDir) {

        Page<OrdenListDto> result = queryService.listOrdenes(
                principal.getTenantId(), estatus, ciudad, tiendaId,
                fechaDesde, fechaHasta, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OrdenDetalleDto>> detalle(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id) {

        OrdenDetalleDto dto = queryService.getDetalle(principal.getTenantId(), id);
        return ResponseEntity.ok(ApiResponse.success(dto));
    }
}
