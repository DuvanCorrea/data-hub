package com.dropitools.datahub.application;

import com.dropitools.datahub.infrastructure.persistence.entity.ImportFileEntity;
import com.dropitools.datahub.infrastructure.persistence.entity.ImportJobEntity;
import com.dropitools.datahub.infrastructure.persistence.repository.ImportFileRepository;
import com.dropitools.datahub.infrastructure.persistence.repository.ImportJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class FileImportService {

    private final ImportFileRepository fileRepository;
    private final ImportJobRepository jobRepository;

    @Value("${app.storage.path}")
    private String storagePath;

    @Transactional
    public ImportJobEntity upload(MultipartFile file, Long tenantId, Long userId) throws IOException {
        // 1. Validar extensión
        String originalName = file.getOriginalFilename();
        if (originalName == null ||
                (!originalName.toLowerCase().endsWith(".xlsx") && !originalName.toLowerCase().endsWith(".xls"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Solo se permiten archivos .xlsx o .xls");
        }

        // 2. SHA-256 del contenido
        byte[] bytes = file.getBytes();
        String sha256 = sha256Hex(bytes);

        // 3. Verificar duplicado
        if (fileRepository.findByTenantIdAndSha256(tenantId, sha256).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Este archivo ya fue subido anteriormente (mismo contenido).");
        }

        // 4. Guardar en disco
        Path dir = Paths.get(storagePath, String.valueOf(tenantId));
        Files.createDirectories(dir);
        String storedFilename = java.util.UUID.randomUUID() + "-" + originalName;
        Path storedPath = dir.resolve(storedFilename);
        Files.write(storedPath, bytes);

        // 5. Registrar en BD: files
        ImportFileEntity fileEntity = new ImportFileEntity();
        fileEntity.setTenantId(tenantId);
        fileEntity.setUserId(userId);
        fileEntity.setOriginalName(originalName);
        fileEntity.setStoredPath(storedPath.toString());
        fileEntity.setSha256(sha256);
        fileEntity.setSizeBytes((long) bytes.length);
        fileEntity.setStatus("UPLOADED");
        fileEntity = fileRepository.save(fileEntity);

        // 6. Crear job en estado PENDING
        ImportJobEntity job = new ImportJobEntity();
        job.setTenantId(tenantId);
        job.setFileId(fileEntity.getId());
        job.setTemplate("DROPI_ORDER");
        job.setStatus("PENDING");
        job = jobRepository.save(job);

        log.info("{\"action\":\"UPLOAD_FILE\",\"tenantId\":{},\"userId\":{},\"fileId\":{},\"jobId\":{}}",
                tenantId, userId, fileEntity.getId(), job.getId());

        return job;
    }

    public Page<ImportJobEntity> listJobs(Long tenantId, Optional<String> status, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return status.map(s -> jobRepository.findByTenantIdAndStatus(tenantId, s, pageable))
                .orElseGet(() -> jobRepository.findByTenantId(tenantId, pageable));
    }

    public ImportJobEntity getJob(Long tenantId, Long jobId) {
        return jobRepository.findByIdAndTenantId(jobId, tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Job no encontrado o no pertenece a este tenant."));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String sha256Hex(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(data));
        } catch (Exception e) {
            throw new RuntimeException("Error calculando SHA-256", e);
        }
    }
}
