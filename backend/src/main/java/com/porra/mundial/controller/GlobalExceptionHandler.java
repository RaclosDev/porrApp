package com.porra.mundial.controller;

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
 * evitando que el Backend devuelva stacktraces feos de Tomcat al Frontend de React.
 */
@ControllerAdvice
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
     * Maneja errores de validación de JSON en entrada de Spring (@Valid en los DTOs).
     * Por ejemplo: enviar un nombre vacío o un JSON con formato incorrecto.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        // Extrae el primer mensaje de validación fallido (anotaciones como @NotBlank o @NotNull)
        String errorMessage = ex.getBindingResult().getFieldErrors().stream()
                .map(org.springframework.validation.FieldError::getDefaultMessage)
                .findFirst()
                .orElse("Datos inválidos");
        errors.put("error", errorMessage);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errors);
    }

    /**
     * Manejador de fallback o comodín. 
     * Atrapa cualquier otra excepción no contemplada (NullPointers, errores de BD graves)
     * para que nunca le llegue un chorro HTML al Frontend.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGenericException(Exception ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "Ha ocurrido un error inesperado: " + ex.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error); // Devuelve HTTP 500
    }
}
