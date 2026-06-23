package com.porra.mundial.controller;

import com.porra.mundial.service.StandingsService;
import com.porra.mundial.service.SyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import com.porra.mundial.repository.BetRepository;
import com.porra.mundial.service.BetService;
import com.porra.mundial.model.Bet;
import com.porra.mundial.dto.BetDataDTO;

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
    private final BetRepository betRepository;
    private final BetService betService;

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

    /**
     * GET /api/standings/official-bracket
     * Devuelve la porra oficial (la que el admin guarda como 'official').
     */
    @GetMapping("/standings/official-bracket")
    public ResponseEntity<?> getOfficialBracket() {
        java.util.Optional<Bet> officialBet = betRepository.findByBetName("official");
        if (officialBet.isPresent()) {
            try {
                BetDataDTO dto = betService.getBetData(officialBet.get().getId());
                return ResponseEntity.ok(dto);
            } catch (Exception e) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Error construyendo la porra oficial"));
            }
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Aún no hay cuadro oficial"));
    }
}
