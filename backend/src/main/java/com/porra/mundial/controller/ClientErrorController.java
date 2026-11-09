package com.porra.mundial.controller;

import io.sentry.Sentry;
import io.sentry.SentryEvent;
import io.sentry.SentryLevel;
import io.sentry.protocol.Message;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Recibe los errores no controlados del navegador para que un fallo en el móvil de un usuario no sea invisible.
 * Los escribe en el log y, si hay SENTRY_DSN, los manda a Sentry, recortados y sin emails ni consultas de la URL;
 * no guarda nada ni identifica al usuario. Así el navegador no carga ningún script ni dominio de terceros.
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
        // En warn: el envío a Sentry desde los log.error agruparía todos los fallos del navegador en uno solo.
        log.warn("Error en el cliente [{}] en {}: {} | {}",
                clean(report.kind(), 20, false), clean(path, MAX_PATH, false),
                clean(report.message(), MAX_MESSAGE, false), clean(report.stack(), MAX_STACK, true));
        // Sin SENTRY_DSN, Sentry está apagado y esto no hace nada.
        Sentry.captureEvent(toSentryEvent(report, path));
        return ResponseEntity.noContent().build();
    }

    /** Un issue de Sentry por tipo y mensaje, con la ruta como transacción y la traza legible. */
    static SentryEvent toSentryEvent(ClientErrorReport report, String path) {
        String kind = clean(report.kind(), 20, false);
        String message = clean(report.message(), MAX_MESSAGE, false);

        Message sentryMessage = new Message();
        sentryMessage.setMessage(message);

        SentryEvent event = new SentryEvent();
        event.setLevel(SentryLevel.ERROR);
        event.setLogger("frontend");
        event.setMessage(sentryMessage);
        event.setTransaction(clean(path, MAX_PATH, false));
        event.setTag("source", "frontend");
        event.setTag("kind", kind);
        event.setExtra("stack", scrub(report.stack(), MAX_STACK));
        event.setFingerprints(List.of("frontend", kind, message));
        return event;
    }

    /** Recorta, quita emails y caracteres de control y deja todo en una línea para que no se puedan falsear entradas del log. */
    static String clean(String value, int max, boolean multiline) {
        String text = scrub(value, max);
        return text.replace("\n", multiline ? " ⏎ " : " ").strip();
    }

    /** Recorta y quita emails y caracteres de control, pero conserva los saltos de línea. */
    private static String scrub(String value, int max) {
        if (value == null || value.isBlank()) return "-";
        String text = value.length() > max ? value.substring(0, max) + "…" : value;
        text = EMAIL.matcher(text).replaceAll("[email]");
        return CONTROL.matcher(text).replaceAll(" ");
    }
}
