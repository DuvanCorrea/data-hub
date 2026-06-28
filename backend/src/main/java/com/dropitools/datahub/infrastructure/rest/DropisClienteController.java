package com.dropitools.datahub.infrastructure.rest;

import com.dropitools.datahub.application.DropisQueryService;
import com.dropitools.datahub.infrastructure.rest.dto.ApiResponse;
import com.dropitools.datahub.infrastructure.rest.dto.dropi.ClienteDto;
import com.dropitools.datahub.infrastructure.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dropi/clientes")
@RequiredArgsConstructor
public class DropisClienteController {

    private final DropisQueryService queryService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<ClienteDto>>> list(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0")   int page,
            @RequestParam(defaultValue = "50")  int size) {

        Page<ClienteDto> result = queryService.listClientes(principal.getTenantId(), q, page, size);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
