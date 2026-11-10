package app.porrapp.controller;

import app.porrapp.dto.ScoreDayDateRequest;
import app.porrapp.dto.ScoreGameNameRequest;
import app.porrapp.dto.ScorePlayerMergeRequest;
import app.porrapp.dto.ScoreGameRequest;
import app.porrapp.dto.ScorePlayerIdsRequest;
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
 * Ligas de juegos de mesa. Todas las rutas exigen sesión ({@code /api/**}): solo las ven sus miembros,
 * que apuntan días de juego, partidas y rondas; su creador es quien borra juegos y la liga.
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

    @PutMapping("/{id}/rounds/{roundId}")
    public ScoreTrackerDTO editRound(@PathVariable Long id, @PathVariable Long roundId,
                                     @Valid @RequestBody ScoreTrackerRoundRequest request, Principal principal) {
        return service.editRound(principal.getName(), id, roundId, request);
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
        return request == null ? service.newSession(principal.getName(), id, null, null, null)
                : service.newSession(principal.getName(), id, request.gameId(), request.playerIds(),
                request.plannedRounds());
    }

    @PutMapping("/{id}/sessions/{sessionId}/players")
    public ScoreTrackerDTO setSessionPlayers(@PathVariable Long id, @PathVariable Long sessionId,
                                             @Valid @RequestBody ScorePlayerIdsRequest request, Principal principal) {
        return service.setSessionPlayers(principal.getName(), id, sessionId, request.playerIds());
    }

    @PostMapping("/{id}/sessions/{sessionId}/end")
    public ScoreTrackerDTO endSession(@PathVariable Long id, @PathVariable Long sessionId, Principal principal) {
        return service.endSession(principal.getName(), id, sessionId);
    }

    @PostMapping("/{id}/sessions/{sessionId}/reopen")
    public ScoreTrackerDTO reopenSession(@PathVariable Long id, @PathVariable Long sessionId, Principal principal) {
        return service.reopenSession(principal.getName(), id, sessionId);
    }

    /** Empieza el día de juego con quienes han venido (sin lista, todos). */
    @PostMapping("/{id}/days")
    @ResponseStatus(HttpStatus.CREATED)
    public ScoreTrackerDTO startDay(@PathVariable Long id,
                                    @Valid @RequestBody(required = false) ScorePlayerIdsRequest request,
                                    Principal principal) {
        return service.startDay(principal.getName(), id, request == null ? null : request.playerIds());
    }

    @PutMapping("/{id}/days/{dayId}/players")
    public ScoreTrackerDTO setDayPlayers(@PathVariable Long id, @PathVariable Long dayId,
                                         @Valid @RequestBody ScorePlayerIdsRequest request, Principal principal) {
        return service.setDayPlayers(principal.getName(), id, dayId, request.playerIds());
    }

    @PostMapping("/{id}/days/{dayId}/close")
    public ScoreTrackerDTO closeDay(@PathVariable Long id, @PathVariable Long dayId, Principal principal) {
        return service.closeDay(principal.getName(), id, dayId);
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

    @PutMapping("/{id}/players/{playerId}")
    public ScoreTrackerDTO renamePlayer(@PathVariable Long id, @PathVariable Long playerId,
                                        @Valid @RequestBody ScoreTrackerPlayerRequest request, Principal principal) {
        return service.renamePlayer(principal.getName(), id, playerId, request.name());
    }

    @DeleteMapping("/{id}/players/{playerId}")
    public ScoreTrackerDTO deletePlayer(@PathVariable Long id, @PathVariable Long playerId, Principal principal) {
        return service.deletePlayer(principal.getName(), id, playerId);
    }

    /** Junta un jugador con otro que era la misma persona. */
    @PostMapping("/{id}/players/{playerId}/merge")
    public ScoreTrackerDTO mergePlayer(@PathVariable Long id, @PathVariable Long playerId,
                                       @Valid @RequestBody ScorePlayerMergeRequest request, Principal principal) {
        return service.mergePlayer(principal.getName(), id, playerId, request.intoPlayerId());
    }

    @DeleteMapping("/{id}/days/{dayId}")
    public ScoreTrackerDTO deleteDay(@PathVariable Long id, @PathVariable Long dayId, Principal principal) {
        return service.deleteDay(principal.getName(), id, dayId);
    }

    /** Pone a un día de juego ya cerrado la fecha en que se jugó. */
    @PutMapping("/{id}/days/{dayId}/date")
    public ScoreTrackerDTO moveDay(@PathVariable Long id, @PathVariable Long dayId,
                                   @Valid @RequestBody ScoreDayDateRequest request, Principal principal) {
        return service.moveDay(principal.getName(), id, dayId, request.date());
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
