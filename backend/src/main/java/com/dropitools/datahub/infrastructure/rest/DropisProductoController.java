package com.dropitools.datahub.infrastructure.rest;

import com.dropitools.datahub.application.DropisQueryService;
import com.dropitools.datahub.infrastructure.persistence.repository.ProductoVariacionRepository;
import com.dropitools.datahub.infrastructure.rest.dto.ApiResponse;
import com.dropitools.datahub.infrastructure.rest.dto.dropi.ProductoDto;
import com.dropitools.datahub.infrastructure.rest.dto.dropi.ProductoVariacionDto;
import com.dropitools.datahub.infrastructure.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dropi/productos")
@RequiredArgsConstructor
public class DropisProductoController {

    private final DropisQueryService          queryService;
    private final ProductoVariacionRepository variacionRepo;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<ProductoDto>>> list(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(defaultValue = "0")   int page,
            @RequestParam(defaultValue = "50")  int size) {

        Page<ProductoDto> result = queryService.listProductos(principal.getTenantId(), page, size);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /** Variaciones de un producto específico */
    @GetMapping("/{productoId}/variaciones")
    public ResponseEntity<ApiResponse<List<ProductoVariacionDto>>> variaciones(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long productoId) {

        List<ProductoVariacionDto> list = variacionRepo
                .findByTenantIdAndProductoId(principal.getTenantId(), productoId)
                .stream()
                .map(v -> ProductoVariacionDto.builder()
                        .id(v.getId())
                        .variacionIdDropi(v.getVariacionIdDropi())
                        .nombreVariacion(v.getNombreVariacion())
                        .createdAt(v.getCreatedAt())
                        .build())
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(list));
    }
}
