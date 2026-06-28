package com.dropitools.datahub.infrastructure.rest;

import com.dropitools.datahub.application.StagingService;
import com.dropitools.datahub.infrastructure.rest.dto.ApiResponse;
import com.dropitools.datahub.infrastructure.rest.dto.StagingPageResponse;
import com.dropitools.datahub.infrastructure.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * GET /api/staging/{jobId}
 *   ?page=0&size=20&sortBy=id&sortDir=asc
 *
 * Devuelve la vista de la tabla de staging correspondiente al job,
 * con columnas y filas definidas dinámicamente según el template.
 */
@RestController
@RequestMapping("/api/staging")
@RequiredArgsConstructor
public class StagingController {

    private final StagingService stagingService;

    @GetMapping("/{jobId}")
    public ResponseEntity<ApiResponse<StagingPageResponse>> getStaging(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long jobId,
            @RequestParam(defaultValue = "0")  int    page,
            @RequestParam(defaultValue = "50") int    size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {

        // Clamp size para evitar peticiones gigantes
        int safeSize = Math.min(size, 200);

        StagingPageResponse result = stagingService.getPage(
                principal.getTenantId(), jobId, page, safeSize, sortBy, sortDir);

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
