package com.dropitools.datahub.infrastructure.rest;

import com.dropitools.datahub.application.FileImportService;
import com.dropitools.datahub.infrastructure.persistence.entity.ImportJobEntity;
import com.dropitools.datahub.infrastructure.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

import com.dropitools.datahub.infrastructure.rest.dto.ApiResponse;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final FileImportService fileImportService;

    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<Map<String, Object>>> upload(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserPrincipal principal) {
        try {
            ImportJobEntity job = fileImportService.upload(file, principal.getTenantId(), principal.getId());
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.created(Map.of("jobId", job.getId(), "fileId", job.getFileId()), "Archivo recibido, procesando."));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
