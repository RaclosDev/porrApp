package com.porra.mundial.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Respuesta de las operaciones que no devuelven datos: {@code {"status": "success"}}.
 *
 * @param status  siempre "success" cuando la operación termina bien
 * @param message texto opcional para mostrar al usuario
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record StatusResponse(String status, String message) {

    public static StatusResponse success() {
        return new StatusResponse("success", null);
    }

    public static StatusResponse success(String message) {
        return new StatusResponse("success", message);
    }
}
