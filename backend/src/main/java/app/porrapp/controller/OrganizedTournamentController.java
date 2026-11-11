package app.porrapp.controller;

import app.porrapp.dto.OrganizedTournamentDTO;
import app.porrapp.dto.OrganizedTournamentDTO.*;
import app.porrapp.service.tournament.OrganizedTournamentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.UUID;

@RestController @RequestMapping("/api/tournaments") @RequiredArgsConstructor
public class OrganizedTournamentController {
    private final OrganizedTournamentService service;

    @GetMapping("/public/{publicId}")
    public ResponseEntity<OrganizedTournamentDTO> publicView(@PathVariable UUID publicId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Robots-Tag", "noindex, nofollow")
                .body(service.publicView(publicId));
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public OrganizedTournamentDTO create(Principal principal, @Valid @RequestBody Create request) {
        return service.create(principal.getName(), request);
    }
    @GetMapping("/{id}")
    public OrganizedTournamentDTO get(Principal principal, @PathVariable Long id) { return service.get(principal.getName(), id); }
    @PutMapping("/{id}/publication")
    public OrganizedTournamentDTO publish(Principal principal, @PathVariable Long id, @Valid @RequestBody Publication request) {
        return service.publish(principal.getName(), id, request);
    }
    @PostMapping("/{id}/participants")
    public OrganizedTournamentDTO addParticipant(Principal principal, @PathVariable Long id, @Valid @RequestBody ParticipantInput request) {
        return service.addParticipant(principal.getName(), id, request);
    }
    @PutMapping("/{id}/participants/{participantId}")
    public OrganizedTournamentDTO renameParticipant(Principal principal, @PathVariable Long id, @PathVariable String participantId, @Valid @RequestBody ParticipantInput request) {
        return service.renameParticipant(principal.getName(), id, participantId, request);
    }
    @DeleteMapping("/{id}/participants/{participantId}")
    public OrganizedTournamentDTO removeParticipant(Principal principal, @PathVariable Long id, @PathVariable String participantId, @RequestParam long revision) {
        return service.removeParticipant(principal.getName(), id, participantId, revision);
    }
    @PutMapping("/{id}/order")
    public OrganizedTournamentDTO order(Principal principal, @PathVariable Long id, @Valid @RequestBody Order request) {
        return service.order(principal.getName(), id, request);
    }
    @PostMapping("/{id}/schedule")
    public OrganizedTournamentDTO generate(Principal principal, @PathVariable Long id, @Valid @RequestBody Schedule request) {
        return service.generate(principal.getName(), id, request);
    }
    @PutMapping("/{id}/positions")
    public OrganizedTournamentDTO swap(Principal principal, @PathVariable Long id, @Valid @RequestBody Swap request) {
        return service.swap(principal.getName(), id, request);
    }
    @DeleteMapping("/{id}/schedule")
    public OrganizedTournamentDTO clear(Principal principal, @PathVariable Long id, @RequestParam long revision) {
        return service.clearSchedule(principal.getName(), id, revision);
    }
    @PostMapping("/{id}/matches")
    public OrganizedTournamentDTO addMatch(Principal principal, @PathVariable Long id, @Valid @RequestBody MatchInput request) {
        return service.addMatch(principal.getName(), id, request);
    }
    @PutMapping("/{id}/matches/{matchId}")
    public OrganizedTournamentDTO details(Principal principal, @PathVariable Long id, @PathVariable String matchId, @Valid @RequestBody MatchDetails request) {
        return service.details(principal.getName(), id, matchId, request);
    }
    @PutMapping("/{id}/matches/{matchId}/result")
    public OrganizedTournamentDTO result(Principal principal, @PathVariable Long id, @PathVariable String matchId, @Valid @RequestBody Result request) {
        return service.result(principal.getName(), id, matchId, request);
    }
}
