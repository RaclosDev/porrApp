package com.porra.mundial.controller;

import com.porra.mundial.dto.ErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.server.ResponseStatusException;

import java.util.NoSuchElementException;

/**
 * Traduce las excepciones a respuestas {@code {"error": "..."}} con el código HTTP adecuado,
 * sin exponer trazas internas al cliente.
 * <ul>
 *   <li>{@link IllegalArgumentException}: 400, dato de entrada no válido.</li>
 *   <li>{@link SecurityException}: 403, sin permiso sobre el recurso.</li>
 *   <li>{@link NoSuchElementException}: 404.</li>
 *   <li>{@link IllegalStateException}: 409, la operación no es posible en el estado actual (p. ej. porra cerrada).</li>
 * </ul>
 */
@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleResponseStatus(ResponseStatusException ex) {
        return error(ex.getStatusCode(), ex.getReason() != null ? ex.getReason() : "Error en la solicitud");
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        return error(HttpStatus.FORBIDDEN, ex.getMessage() != null ? ex.getMessage() : "Acceso denegado");
    }

    /** Archivo por encima de spring.servlet.multipart.max-file-size. */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        return error(HttpStatus.PAYLOAD_TOO_LARGE, "La imagen supera el tamaño máximo de 3 MB.");
    }

    /** Petición multipart sin el campo "file" o mal formada. */
    @ExceptionHandler({MissingServletRequestPartException.class, MultipartException.class})
    public ResponseEntity<ErrorResponse> handleMultipartProblems(Exception ex) {
        return error(HttpStatus.BAD_REQUEST, "No se ha recibido ningún archivo válido.");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return error(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(NoSuchElementException ex) {
        return error(HttpStatus.NOT_FOUND, ex.getMessage() != null ? ex.getMessage() : "Recurso no encontrado");
    }

    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<ErrorResponse> handleSecurity(SecurityException ex) {
        return error(HttpStatus.FORBIDDEN, ex.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleIllegalState(IllegalStateException ex) {
        return error(HttpStatus.CONFLICT, ex.getMessage());
    }

    /** Restricciones de unicidad o integridad violadas, normalmente por peticiones concurrentes. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrity(DataIntegrityViolationException ex) {
        log.warn("Violación de integridad de datos: {}", ex.getMessage());
        return error(HttpStatus.CONFLICT, "Conflicto con los datos existentes o registro duplicado.");
    }

    /** Validación de los DTOs con @Valid: se devuelve el primer mensaje de error. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .findFirst()
                .orElse("Datos inválidos");
        return error(HttpStatus.BAD_REQUEST, message);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ErrorResponse> handleMalformedRequest(Exception ex) {
        return error(HttpStatus.BAD_REQUEST, "La petición no tiene un formato válido.");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
        // Errores del propio Spring MVC (ruta inexistente, método no permitido...) conservan su código HTTP.
        if (ex instanceof org.springframework.web.ErrorResponse springError) {
            String detail = springError.getBody().getDetail();
            return error(springError.getStatusCode(), detail != null ? detail : "Error en la solicitud");
        }
        log.error("Excepción no controlada en el servidor: ", ex);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "Ha ocurrido un error inesperado en el servidor.");
    }

    private static ResponseEntity<ErrorResponse> error(HttpStatusCode status, String message) {
        return ResponseEntity.status(status).body(new ErrorResponse(message));
    }
}
