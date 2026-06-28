package com.dropitools.datahub.infrastructure.rest;

import com.dropitools.datahub.application.DropisQueryService;
import com.dropitools.datahub.infrastructure.rest.dto.ApiResponse;
import com.dropitools.datahub.infrastructure.rest.dto.dropi.DropisStatsDto;
import com.dropitools.datahub.infrastructure.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/dropi/stats")
@RequiredArgsConstructor
public class DropisStatsController {

    private final DropisQueryService queryService;

    /**
     * KPIs y distribuciones con filtro de fechas.
     * Default si no se envían parámetros: última semana (7 días).
     */
    @GetMapping
    public ResponseEntity<ApiResponse<DropisStatsDto>> stats(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fechaDesde,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fechaHasta) {

        LocalDate hasta = fechaHasta != null ? fechaHasta : LocalDate.now();
        LocalDate desde = fechaDesde != null ? fechaDesde : hasta.minusDays(6);

        DropisStatsDto dto = queryService.getStats(principal.getTenantId(), desde, hasta);
        return ResponseEntity.ok(ApiResponse.success(dto));
    }
}
