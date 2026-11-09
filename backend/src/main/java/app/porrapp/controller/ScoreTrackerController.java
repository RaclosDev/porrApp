package app.porrapp.controller;

import app.porrapp.dto.ScoreGameNameRequest;
import app.porrapp.dto.ScoreGameRequest;
import app.porrapp.dto.ScoreTrackerClaimRequest;
import app.porrapp.dto.ScoreTrackerDTO;
import app.porrapp.dto.ScoreTrackerJoinRequest;
import app.porrapp.dto.ScoreTrackerPlayerRequest;
import app.porrapp.dto.ScoreTrackerRequest;
import app.porrapp.dto.ScoreTrackerRoundRequest;
import app.porrapp.dto.ScoreTrackerSessionRequest;
import app.porrapp.dto.ScoreTrackerSummaryDTO;
import app.porrapp.dto.StatusResponse;
import app.porrapp.service.league.ScoreTrackerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * Marcadores de juegos de mesa. Todas las rutas exigen sesión ({@code /api/**}): solo los ven quien
 * los creó y quien entró con su código, y solo su creador apunta partidas.
 */
@RestController
@RequestMapping("/api/trackers")
@RequiredArgsConstructor
public class ScoreTrackerController {

    private final ScoreTrackerService service;

    @GetMapping
    public List<ScoreTrackerSummaryDTO> mine(Principal principal) {
        return service.mine(principal.getName());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ScoreTrackerDTO create(@Valid @RequestBody ScoreTrackerRequest request, Principal principal) {
        return service.create(principal.getName(), request);
    }

    @PostMapping("/join")
    public ScoreTrackerDTO join(@Valid @RequestBody ScoreTrackerJoinRequest request, Principal principal) {
        return service.join(principal.getName(), request.code());
    }

    @GetMapping("/{id}")
    public ScoreTrackerDTO get(@PathVariable Long id, Principal principal) {
        return service.get(principal.getName(), id);
    }

    @PostMapping("/{id}/rounds")
    @ResponseStatus(HttpStatus.CREATED)
    public ScoreTrackerDTO addRound(@PathVariable Long id, @Valid @RequestBody ScoreTrackerRoundRequest request,
                                    Principal principal) {
        return service.addRound(principal.getName(), id, request);
    }

    @DeleteMapping("/{id}/rounds/{roundId}")
    public ScoreTrackerDTO deleteRound(@PathVariable Long id, @PathVariable Long roundId, Principal principal) {
        return service.deleteRound(principal.getName(), id, roundId);
    }

    @PostMapping("/{id}/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    public ScoreTrackerDTO newSession(@PathVariable Long id,
                                      @Valid @RequestBody(required = false) ScoreTrackerSessionRequest request,
                                      Principal principal) {
        return service.newSession(principal.getName(), id, request == null ? null : request.gameId());
    }

    /** Añade otro juego a la liga (el que se juega algún día). */
    @PostMapping("/{id}/games")
    @ResponseStatus(HttpStatus.CREATED)
    public ScoreTrackerDTO addGame(@PathVariable Long id, @Valid @RequestBody ScoreGameRequest request,
                                   Principal principal) {
        return service.addGame(principal.getName(), id, request);
    }

    @PutMapping("/{id}/games/{gameId}")
    public ScoreTrackerDTO renameGame(@PathVariable Long id, @PathVariable Long gameId,
                                      @Valid @RequestBody ScoreGameNameRequest request, Principal principal) {
        return service.renameGame(principal.getName(), id, gameId, request);
    }

    @DeleteMapping("/{id}/games/{gameId}")
    public ScoreTrackerDTO deleteGame(@PathVariable Long id, @PathVariable Long gameId, Principal principal) {
        return service.deleteGame(principal.getName(), id, gameId);
    }

    @PostMapping("/{id}/players")
    @ResponseStatus(HttpStatus.CREATED)
    public ScoreTrackerDTO addPlayer(@PathVariable Long id, @Valid @RequestBody ScoreTrackerPlayerRequest request,
                                     Principal principal) {
        return service.addPlayer(principal.getName(), id, request.name());
    }

    /** El usuario se apunta a uno de los jugadores como «soy yo». */
    @PutMapping("/{id}/me")
    public ScoreTrackerDTO claimPlayer(@PathVariable Long id, @Valid @RequestBody ScoreTrackerClaimRequest request,
                                       Principal principal) {
        return service.claimPlayer(principal.getName(), id, request.playerId());
    }

    @DeleteMapping("/{id}/me")
    public ScoreTrackerDTO releasePlayer(@PathVariable Long id, Principal principal) {
        return service.releasePlayer(principal.getName(), id);
    }

    @DeleteMapping("/{id}")
    public StatusResponse delete(@PathVariable Long id, Principal principal) {
        service.delete(principal.getName(), id);
        return StatusResponse.success();
    }

    @DeleteMapping("/{id}/membership")
    public StatusResponse leave(@PathVariable Long id, Principal principal) {
        service.leave(principal.getName(), id);
        return StatusResponse.success();
    }
}
