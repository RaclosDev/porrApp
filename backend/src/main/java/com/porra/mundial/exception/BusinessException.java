package com.porra.mundial.exception;

import org.springframework.http.HttpStatus;

import java.util.Objects;

/** An explicitly classified domain error whose message is safe to return to the client. */
public final class BusinessException extends RuntimeException {

    private final HttpStatus status;

    public BusinessException(HttpStatus status, String userMessage) {
        super(requireUserMessage(userMessage));
        this.status = requireClientErrorStatus(status);
    }

    public HttpStatus getStatus() {
        return status;
    }

    public static BusinessException badRequest(String message) {
        return new BusinessException(HttpStatus.BAD_REQUEST, message);
    }

    public static BusinessException forbidden(String message) {
        return new BusinessException(HttpStatus.FORBIDDEN, message);
    }

    public static BusinessException notFound(String message) {
        return new BusinessException(HttpStatus.NOT_FOUND, message);
    }

    public static BusinessException conflict(String message) {
        return new BusinessException(HttpStatus.CONFLICT, message);
    }

    private static HttpStatus requireClientErrorStatus(HttpStatus status) {
        HttpStatus value = Objects.requireNonNull(status, "status");
        if (!value.is4xxClientError()) {
            throw new IllegalArgumentException("BusinessException solo admite estados HTTP 4xx");
        }
        return value;
    }

    private static String requireUserMessage(String message) {
        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException("BusinessException requiere un mensaje público no vacío");
        }
        return message;
    }
}
