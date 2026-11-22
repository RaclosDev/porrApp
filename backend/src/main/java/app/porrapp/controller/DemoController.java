package app.porrapp.controller;

import app.porrapp.service.demo.DemoSnapshotService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/** Datos en vivo, anonimizados, de las ligas que enseña la demo pública (/demo). */
@RestController
@RequiredArgsConstructor
public class DemoController {

    private final DemoSnapshotService snapshots;

    @GetMapping("/api/demo/data")
    public ResponseEntity<byte[]> data() {
        return snapshots.snapshot()
                .map(json -> ResponseEntity.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                        .body(json))
                // Aún preparándose: la demo tira de su copia fija.
                .orElseGet(() -> ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build());
    }
}
