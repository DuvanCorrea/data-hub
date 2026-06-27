package com.dropitools.datahub.infrastructure.rest;

import com.dropitools.datahub.application.AuthService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.dropitools.datahub.infrastructure.security.UserPrincipal;
import java.util.Map;

import com.dropitools.datahub.infrastructure.rest.dto.ApiResponse;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Data
    public static class LoginRequest {
        @NotBlank
        private String username;
        @NotBlank
        private String password;
    }

    /**
     * Login: el tenantId viene en el body porque todavía no tenemos token.
     * Después del login el tenantId siempre se lee del JWT — nunca más en cabeceras.
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<Map<String, Object>>> login(@Valid @RequestBody LoginRequest request) {
        return authService.authenticate(request.getUsername(), request.getPassword())
                .map(token -> ResponseEntity.ok(ApiResponse.success(Map.of(
                        "accessToken", token,
                        "expiresIn", 3600
                ))))
                .orElse(ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(ApiResponse.error(401, "Credenciales inválidas o usuario inactivo")));
    }

    /**
     * Perfil del usuario autenticado.
     * tenantId se extrae del JWT via UserPrincipal — sin X-Tenant-ID.
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<?>> me(@AuthenticationPrincipal UserPrincipal principal) {
        return authService.getCurrentUser(principal.getTenantId(), principal.getId())
                .map(u -> ResponseEntity.ok(ApiResponse.success(u)))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error(404, "Usuario no encontrado")));
    }
}
