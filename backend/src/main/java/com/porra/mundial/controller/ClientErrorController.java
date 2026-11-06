package com.porra.mundial.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.regex.Pattern;

/**
 * Recibe los errores no controlados del navegador para que un fallo en el móvil de un usuario no sea invisible.
 * Solo los escribe en el log, recortados y sin emails ni consultas de la URL; no guarda nada ni identifica al usuario.
 */
@Slf4j
@RestController
@RequestMapping("/api/client-errors")
public class ClientErrorController {

    static final int MAX_MESSAGE = 500;
    static final int MAX_STACK = 2000;
    static final int MAX_PATH = 200;
    private static final Pattern EMAIL = Pattern.compile("[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+");
    private static final Pattern CONTROL = Pattern.compile("[\\p{Cntrl}&&[^\\n]]");

    public record ClientErrorReport(String kind, String message, String stack, String path) {}

    @PostMapping
    public ResponseEntity<Void> report(@RequestBody ClientErrorReport report) {
        String path = report.path() == null ? "" : report.path().split("[?#]", 2)[0];
        log.warn("Error en el cliente [{}] en {}: {} | {}",
                clean(report.kind(), 20, false), clean(path, MAX_PATH, false),
                clean(report.message(), MAX_MESSAGE, false), clean(report.stack(), MAX_STACK, true));
        return ResponseEntity.noContent().build();
    }

    /** Recorta, quita emails y caracteres de control y deja todo en una línea para que no se puedan falsear entradas del log. */
    static String clean(String value, int max, boolean multiline) {
        if (value == null || value.isBlank()) return "-";
        String text = value.length() > max ? value.substring(0, max) + "…" : value;
        text = EMAIL.matcher(text).replaceAll("[email]");
        text = CONTROL.matcher(text).replaceAll(" ");
        return text.replace("\n", multiline ? " ⏎ " : " ").strip();
    }
}
