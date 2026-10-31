package com.porra.mundial.dto;

import jakarta.validation.constraints.Pattern;

/**
 * Cambio del estado de pago de un miembro. Si no se indica, se marca como pagado.
 *
 * @param status PAID o PENDING
 */
public record MemberPaymentRequest(
        @Pattern(regexp = "PAID|PENDING", message = "Estado de pago no válido")
        String status) {

    public String statusOrDefault() {
        return status != null ? status : "PAID";
    }
}
