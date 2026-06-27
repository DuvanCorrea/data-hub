package com.dropitools.datahub.infrastructure.rest;

import com.dropitools.datahub.application.FileImportService;
import com.dropitools.datahub.infrastructure.persistence.entity.ImportJobEntity;
import com.dropitools.datahub.infrastructure.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

import com.dropitools.datahub.infrastructure.rest.dto.ApiResponse;

@RestController
@RequestMapping("/api/import-jobs")
@RequiredArgsConstructor
public class ImportJobController {

    private final FileImportService fileImportService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<Map<String, Object>>>> list(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam Optional<String> status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Page<ImportJobEntity> jobs = fileImportService.listJobs(principal.getTenantId(), status, page, size);
        return ResponseEntity.ok(ApiResponse.success(jobs.map(this::toDto)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getById(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id) {

        ImportJobEntity job = fileImportService.getJob(principal.getTenantId(), id);
        return ResponseEntity.ok(ApiResponse.success(toDto(job)));
    }

    // ── DTO inline ───────────────────────────────────────────────────────────

    private Map<String, Object> toDto(ImportJobEntity j) {
        int progress = (j.getRowsTotal() != null && j.getRowsTotal() > 0)
                ? j.getRowsDone() * 100 / j.getRowsTotal() : 0;
        return Map.of(
                "id", j.getId(),
                "status", j.getStatus(),
                "progress", progress,
                "rowsDone", j.getRowsDone(),
                "rowsTotal", j.getRowsTotal() != null ? j.getRowsTotal() : 0,
                "template", j.getTemplate(),
                "startedAt", j.getStartedAt() != null ? j.getStartedAt().toString() : "",
                "finishedAt", j.getFinishedAt() != null ? j.getFinishedAt().toString() : "",
                "errorMsg", j.getErrorMsg() != null ? j.getErrorMsg() : ""
        );
    }
}
