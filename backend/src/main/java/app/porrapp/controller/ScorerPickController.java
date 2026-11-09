package app.porrapp.controller;

import app.porrapp.dto.ScorerPickDTO;
import app.porrapp.dto.ScorerPickRequest;
import app.porrapp.dto.ScorerPickStateDTO;
import app.porrapp.service.league.LeagueService;
import app.porrapp.service.league.ScorerPickService;
import app.porrapp.service.notification.WebSocketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

/**
 * Pichichi de una liga. Las lecturas son públicas en las ligas públicas y para los miembros de una privada;
 * elegirlo exige sesión (ver {@code SecurityConfig}) y asignar uno dudoso, ser el administrador.
 */
@RestController
@RequestMapping("/api/groups/{id}")
@RequiredArgsConstructor
public class ScorerPickController {

    private final ScorerPickService scorerPickService;
    private final LeagueService leagueService;
    private final WebSocketService webSocketService;

    /** Si la liga juega el pichichi, hasta cuándo se elige y el de quien consulta. */
    @GetMapping("/scorer-pick")
    public ScorerPickStateDTO getState(@PathVariable Long id, Principal principal) {
        String email = CurrentUser.email(principal);
        leagueService.assertCanView(id, email);
        return scorerPickService.state(id, email);
    }

    /** Elige o cambia el pichichi propio en una liga que lo elige aparte del cuadro. */
    @PutMapping("/scorer-pick")
    public ScorerPickStateDTO save(@PathVariable Long id, @Valid @RequestBody ScorerPickRequest body, Principal principal) {
        String email = CurrentUser.email(principal);
        leagueService.assertCanView(id, email);
        return scorerPickService.save(id, email, body.name(), body.playerId());
    }

    /** Pichichis de la liga; con el plazo abierto, solo el propio. */
    @GetMapping("/scorer-picks")
    public List<ScorerPickDTO> getPicks(@PathVariable Long id, Principal principal) {
        String email = CurrentUser.email(principal);
        leagueService.assertCanView(id, email);
        return scorerPickService.picks(id, email);
    }

    /** El administrador asigna el jugador de un pichichi dudoso, o quita el que asignó (sin {@code playerId}). */
    @PutMapping("/scorer-picks/{predictionId}")
    public ScorerPickDTO assign(@PathVariable Long id, @PathVariable Long predictionId,
                                @Valid @RequestBody ScorerPickRequest body, Principal principal) {
        ScorerPickDTO pick = scorerPickService.assign(id, predictionId, body.playerId(), CurrentUser.email(principal));
        // Las sesiones que ven la liga vuelven a pedir la clasificación.
        webSocketService.notifyLeagueChanged(id);
        return pick;
    }
}
