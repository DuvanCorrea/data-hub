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
 * Endpoints de staging:
 *
 *   GET /api/staging/{jobId}          → registros de un job específico
 *   GET /api/staging?template=X       → TODOS los registros del tenant para ese template
 */
@RestController
@RequestMapping("/api/staging")
@RequiredArgsConstructor
public class StagingController {

    private final StagingService stagingService;

    /** Vista filtrada por job */
    @GetMapping("/{jobId}")
    public ResponseEntity<ApiResponse<StagingPageResponse>> getByJob(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long jobId,
            @RequestParam(defaultValue = "0")    int    page,
            @RequestParam(defaultValue = "50")   int    size,
            @RequestParam(defaultValue = "id")   String sortBy,
            @RequestParam(defaultValue = "asc")  String sortDir) {

        StagingPageResponse result = stagingService.getPage(
                principal.getTenantId(), jobId, page, Math.min(size, 200), sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /** Vista global (sin filtro de job) — requiere ?template=DROPI_ORDER */
    @GetMapping
    public ResponseEntity<ApiResponse<StagingPageResponse>> getAll(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(defaultValue = "DROPI_ORDER") String template,
            @RequestParam(defaultValue = "0")           int    page,
            @RequestParam(defaultValue = "50")          int    size,
            @RequestParam(defaultValue = "id")          String sortBy,
            @RequestParam(defaultValue = "desc")        String sortDir) {

        StagingPageResponse result = stagingService.getAllPage(
                principal.getTenantId(), template, page, Math.min(size, 200), sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
