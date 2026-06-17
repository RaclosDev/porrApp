package com.porra.mundial.controller;

import com.porra.mundial.service.StandingsService;
import com.porra.mundial.service.SyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 📊 Controlador de Clasificaciones
 * Se encarga de devolver a la web la tabla de puntos oficial y de 
 * permitir que el Admin pulse el botón de "Forzar Sincronización".
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class StandingsController {

    private final StandingsService standingsService;
    private final SyncService syncService;

    /**
     * 🥇 GET /api/standings
     * La web nos pide la clasificación actual.
     * Devuelve los equipos ya ordenados mágicamente por el algoritmo de desempate de la FIFA.
     */
    @GetMapping("/standings")
    public Map<String, Map<String, Map<String, Integer>>> getStandings() {
        return standingsService.getOfficialPoints();
    }

    /**
     * 🔄 POST /api/sync
     * ¡Botón de pánico del Admin! 
     * Fuerza a Java a descargar los datos de la FIFA ahora mismo sin esperar 15 minutos.
     */
    @PostMapping("/sync")
    public Map<String, Object> syncNow() {
        return syncService.syncAll();
    }
}
