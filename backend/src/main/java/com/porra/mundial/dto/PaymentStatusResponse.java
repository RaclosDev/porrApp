package com.porra.mundial.dto;

/**
 * Estado de pago de un miembro tras cambiarlo.
 *
 * @param status        siempre "success"
 * @param paymentStatus PAID o PENDING
 */
public record PaymentStatusResponse(String status, String paymentStatus) {

    public static PaymentStatusResponse success(String paymentStatus) {
        return new PaymentStatusResponse("success", paymentStatus);
    }
}
