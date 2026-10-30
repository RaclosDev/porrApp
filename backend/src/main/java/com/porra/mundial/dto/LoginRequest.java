package com.porra.mundial.dto;

import jakarta.validation.constraints.NotBlank;

/** @param credential ID token que devuelve Google Identity Services */
public record LoginRequest(@NotBlank(message = "Falta la credencial de Google") String credential) {
}
