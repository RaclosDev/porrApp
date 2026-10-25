package com.porra.mundial.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.HashMap;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Gestor Global de Excepciones para la API REST.
 * Actúa como una red de seguridad (@ControllerAdvice) que intercepta los errores lanzados 
 * en cualquier punto de los Controladores y los transforma en respuestas JSON estructuradas, 
 * evitando la fuga de trazas internas o datos sensibles hacia el cliente.
 */
@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /**
     * Maneja errores de validación de negocio (ej. "El grupo no permite más apuestas").
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgumentException(IllegalArgumentException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error); // Devuelve código HTTP 400
    }

    /**
     * Maneja errores cuando se busca en BD una entidad que no existe (ej. Grupo Borrado o Apuesta Borrada).
     */
    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, String>> handleNoSuchElementException(NoSuchElementException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", ex.getMessage() != null ? ex.getMessage() : "Recurso no encontrado");
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error); // Devuelve código HTTP 404
    }

    /**
     * Maneja errores de permisos (ej. "Solo el administrador de este grupo puede borrarlo").
     */
    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<Map<String, String>> handleSecurityException(SecurityException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error); // Devuelve código HTTP 403
    }

    /**
     * Maneja errores de estado o plazos vencidos (ej. porra bloqueada tras el cierre).
     */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleIllegalStateException(IllegalStateException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(error);
    }

    /**
     * Maneja violaciones de integridad relacional o restricciones de unicidad concurrentes.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrityViolationException(DataIntegrityViolationException ex) {
        log.warn("Violación de integridad de datos en base de datos: {}", ex.getMessage());
        Map<String, String> error = new HashMap<>();
        error.put("error", "Conflicto con los datos existentes o registro duplicado.");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(error);
    }

    /**
     * Maneja errores de validación de JSON en entrada de Spring (@Valid en los DTOs).
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        String errorMessage = ex.getBindingResult().getFieldErrors().stream()
                .map(org.springframework.validation.FieldError::getDefaultMessage)
                .findFirst()
                .orElse("Datos inválidos");
        errors.put("error", errorMessage);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errors);
    }

    /**
     * Manejador de fallback o comodín sanitizado.
     * Atrapa cualquier otra excepción no contemplada evitando exponer detalles internos de BD o Tomcat.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGenericException(Exception ex) {
        log.error("Excepción no controlada en el servidor: ", ex);
        Map<String, String> error = new HashMap<>();
        error.put("error", "Ha ocurrido un error inesperado en el servidor.");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
}
