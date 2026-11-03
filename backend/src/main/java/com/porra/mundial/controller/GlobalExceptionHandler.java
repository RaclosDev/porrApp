package com.porra.mundial.controller;

import com.porra.mundial.dto.ErrorResponse;
import com.porra.mundial.exception.BusinessException;
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

/**
 * Traduce las excepciones a respuestas {@code {"error": "..."}} con el código HTTP adecuado,
 * sin exponer trazas internas al cliente.
 * <ul>
 *   <li>{@link BusinessException}: errores de dominio clasificados explícitamente como seguros.</li>
 *   <li>Las excepciones técnicas no clasificadas devuelven un error genérico 500.</li>
 * </ul>
 */
@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleResponseStatus(ResponseStatusException ex) {
        if (ex.getStatusCode().is5xxServerError()
                && ex.getStatusCode().value() != HttpStatus.SERVICE_UNAVAILABLE.value()) {
            log.error("Error interno indicado por ResponseStatusException", ex);
            return error(ex.getStatusCode(), "Ha ocurrido un error inesperado en el servidor.");
        }
        if (ex.getStatusCode().value() == HttpStatus.SERVICE_UNAVAILABLE.value()) {
            log.warn("Servicio temporalmente no disponible: {}", ex.getReason());
        }
        String message = ex.getReason();
        if (message == null || message.isBlank()) {
            message = HttpStatus.resolve(ex.getStatusCode().value()) != null
                    ? HttpStatus.resolve(ex.getStatusCode().value()).getReasonPhrase()
                    : "Error en la solicitud";
        }
        return error(ex.getStatusCode(), message);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        return error(HttpStatus.FORBIDDEN, "Acceso denegado.");
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

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusiness(BusinessException ex) {
        return error(ex.getStatus(), ex.getMessage());
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
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElse("Los datos enviados no son válidos.");
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
            if (springError.getStatusCode().is5xxServerError()) {
                log.error("Error interno del framework web: ", ex);
                return error(springError.getStatusCode(), "Ha ocurrido un error inesperado en el servidor.");
            }
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
