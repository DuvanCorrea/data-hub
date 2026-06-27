package com.dropitools.datahub.infrastructure.rest.dto;

import lombok.Builder;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@Builder
public class ApiResponse<T> {
    private int status;
    private String message;
    private T data;
    @Builder.Default
    private OffsetDateTime timestamp = OffsetDateTime.now();

    public static <T> ApiResponse<T> success(T data) {
        return ApiResponse.<T>builder().status(200).message("Operación exitosa").data(data).build();
    }

    public static <T> ApiResponse<T> success(T data, String message) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }

    public static <T> ApiResponse<T> created(T data, String message) {
        return ApiResponse.<T>builder().status(201).message(message).data(data).build();
    }

    public static ApiResponse<Void> error(int status, String message) {
        return ApiResponse.<Void>builder().status(status).message(message).data(null).build();
    }
}
