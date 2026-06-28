package com.dropitools.datahub.infrastructure.rest;

import com.dropitools.datahub.application.DropisQueryService;
import com.dropitools.datahub.infrastructure.rest.dto.ApiResponse;
import com.dropitools.datahub.infrastructure.rest.dto.dropi.DropisStatsDto;
import com.dropitools.datahub.infrastructure.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dropi/stats")
@RequiredArgsConstructor
public class DropisStatsController {

    private final DropisQueryService queryService;

    /** Un único endpoint devuelve todos los KPIs y distribuciones de una vez. */
    @GetMapping
    public ResponseEntity<ApiResponse<DropisStatsDto>> stats(
            @AuthenticationPrincipal UserPrincipal principal) {

        DropisStatsDto dto = queryService.getStats(principal.getTenantId());
        return ResponseEntity.ok(ApiResponse.success(dto));
    }
}
