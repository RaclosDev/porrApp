package app.porrapp.controller;

import app.porrapp.dto.LeagueScoringDTO;
import app.porrapp.scoring.ScoringRuleSet;
import app.porrapp.service.league.LeagueScoringService;
import app.porrapp.service.notification.WebSocketService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

import java.security.Principal;

/**
 * Puntuación de una liga. La lectura es pública en las ligas públicas y para los miembros de una
 * liga privada; el cambio exige sesión (ver {@code SecurityConfig}) y ser su administrador.
 */
@RestController
@RequestMapping("/api/groups/{id}/scoring")
@RequiredArgsConstructor
public class LeagueScoringController {

    private final LeagueScoringService leagueScoringService;
    private final WebSocketService webSocketService;

    /** Reglas con las que puntúa la liga, las de por defecto y si quien consulta puede cambiarlas. */
    @GetMapping
    public LeagueScoringDTO getScoring(@PathVariable Long id, Principal principal) {
        return leagueScoringService.getScoring(id, principal != null ? principal.getName() : null);
    }

    /**
     * Cambia las reglas y recalcula los puntos de la liga. Las reglas que no se envían toman su valor por defecto.
     * Solo el administrador de la liga.
     */
    @PutMapping
    public LeagueScoringDTO updateScoring(@PathVariable Long id, @RequestBody JsonNode body, Principal principal) {
        LeagueScoringDTO scoring = leagueScoringService.updateScoring(id, ScoringRuleSet.fromRequest(body),
                principal.getName());
        // Las sesiones que ven la liga vuelven a pedir la clasificación y la puntuación.
        webSocketService.notifyLeagueChanged(id);
        return scoring;
    }
}
