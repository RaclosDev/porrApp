package app.porrapp.controller;

import app.porrapp.dto.PokerDTO.*;
import app.porrapp.dto.ScoreTrackerPlayerRequest;
import app.porrapp.service.league.PokerLeagueService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/poker")
@RequiredArgsConstructor
public class PokerLeagueController {
    private final PokerLeagueService service;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LeagueView create(Principal principal, @Valid @RequestBody CreateLeague request) {
        return service.create(principal.getName(), request);
    }

    @GetMapping("/{id}")
    public LeagueView get(Principal principal, @PathVariable Long id) {
        return service.get(principal.getName(), id);
    }

    @GetMapping("/{id}/history")
    public List<Session> history(Principal principal, @PathVariable Long id) {
        return service.history(principal.getName(), id);
    }

    @PostMapping("/{id}/sessions/{sessionId}/guests")
    @ResponseStatus(HttpStatus.CREATED)
    public LeagueView addGuest(Principal principal, @PathVariable Long id, @PathVariable Long sessionId,
                               @Valid @RequestBody ScoreTrackerPlayerRequest request) {
        return service.addGuest(principal.getName(), id, sessionId, request.name());
    }

    @PostMapping("/{id}/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    public LeagueView schedule(Principal principal, @PathVariable Long id,
                               @Valid @RequestBody CreateSession request) {
        return service.schedule(principal.getName(), id, request);
    }

    @PutMapping("/{id}/sessions/{sessionId}")
    public LeagueView edit(Principal principal, @PathVariable Long id, @PathVariable Long sessionId,
                           @Valid @RequestBody EditSession request) {
        return service.edit(principal.getName(), id, sessionId, request);
    }

    @PutMapping("/{id}/sessions/{sessionId}/attendance")
    public LeagueView attendance(Principal principal, @PathVariable Long id, @PathVariable Long sessionId,
                                 @Valid @RequestBody Attendance request) {
        return service.attendance(principal.getName(), id, sessionId, request);
    }

    @PostMapping("/{id}/sessions/{sessionId}/commands")
    public LeagueView command(Principal principal, @PathVariable Long id, @PathVariable Long sessionId,
                              @Valid @RequestBody Command command) {
        return service.command(principal.getName(), id, sessionId, command);
    }
}
