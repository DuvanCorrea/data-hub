package com.dropitools.datahub.infrastructure.rest;

import com.dropitools.datahub.application.ParametroService;
import com.dropitools.datahub.infrastructure.persistence.entity.ParametroEntity;
import com.dropitools.datahub.infrastructure.rest.dto.ApiResponse;
import com.dropitools.datahub.infrastructure.rest.dto.ParametroDto;
import com.dropitools.datahub.infrastructure.security.UserPrincipal;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/parametros")
@RequiredArgsConstructor
public class ParametroController {

    private final ParametroService service;
    private final ObjectMapper mapper;

    /** Lista todos los parámetros, agrupados por aplicación */
    @GetMapping
    public ResponseEntity<ApiResponse<List<ParametroDto>>> list() {
        List<ParametroDto> dtos = service.listAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(dtos));
    }

    /** Actualiza el valor de un parámetro — solo ADMIN */
    @PutMapping("/{clave}")
    public ResponseEntity<ApiResponse<ParametroDto>> update(
            @PathVariable String clave,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal principal) {

        if (!"ADMIN".equals(principal.getRole())) {
            return ResponseEntity.status(403)
                    .body(ApiResponse.error(403, "Solo administradores pueden modificar parámetros."));
        }
        String nuevoValor = body.get("valor");
        if (nuevoValor == null) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Campo 'valor' requerido."));
        }
        ParametroEntity saved = service.update(clave, nuevoValor, principal.getId());
        return ResponseEntity.ok(ApiResponse.success(toDto(saved)));
    }

    /** Resetea el valor al valor por defecto — solo ADMIN */
    @PostMapping("/{clave}/reset")
    public ResponseEntity<ApiResponse<ParametroDto>> reset(
            @PathVariable String clave,
            @AuthenticationPrincipal UserPrincipal principal) {

        if (!"ADMIN".equals(principal.getRole())) {
            return ResponseEntity.status(403)
                    .body(ApiResponse.error(403, "Solo administradores pueden modificar parámetros."));
        }
        ParametroEntity saved = service.reset(clave, principal.getId());
        return ResponseEntity.ok(ApiResponse.success(toDto(saved)));
    }

    /** Resetea TODOS los parámetros a su valor por defecto — solo ADMIN */
    @PostMapping("/reset-all")
    public ResponseEntity<ApiResponse<List<ParametroDto>>> resetAll(
            @AuthenticationPrincipal UserPrincipal principal) {

        if (!"ADMIN".equals(principal.getRole())) {
            return ResponseEntity.status(403)
                    .body(ApiResponse.error(403, "Solo administradores pueden modificar parámetros."));
        }
        service.resetAll(principal.getId());
        List<ParametroDto> dtos = service.listAll().stream()
                .map(this::toDto).collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(dtos));
    }

    private ParametroDto toDto(ParametroEntity e) {
        List<ParametroDto.OpcionDto> opciones = parseOpciones(e.getOpciones());
        return ParametroDto.builder()
                .id(e.getId())
                .aplicacion(e.getAplicacion())
                .clave(e.getClave())
                .etiqueta(e.getEtiqueta())
                .descripcion(e.getDescripcion())
                .tipoDato(e.getTipoDato())
                .valor(e.getValor())
                .valorDefecto(e.getValorDefecto())
                .valorModificado(!e.getValor().equals(e.getValorDefecto()))
                .opciones(opciones)
                .esEditable(Boolean.TRUE.equals(e.getEsEditable()))
                .orden(e.getOrden() != null ? e.getOrden() : 0)
                .updatedAt(e.getUpdatedAt())
                .updatedBy(e.getUpdatedBy())
                .build();
    }

    private List<ParametroDto.OpcionDto> parseOpciones(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<Map<String, String>> raw = mapper.readValue(
                    json, new TypeReference<>() {});
            return raw.stream()
                    .map(m -> ParametroDto.OpcionDto.builder()
                            .valor(m.get("valor"))
                            .etiqueta(m.get("etiqueta"))
                            .build())
                    .collect(Collectors.toList());
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }
}
