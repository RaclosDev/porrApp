package com.porra.mundial.controller;

import com.porra.mundial.dto.CustomMatchRequest;
import com.porra.mundial.dto.CustomResultRequest;
import com.porra.mundial.dto.CustomTeamRequest;
import com.porra.mundial.dto.MatchResponseDTO;
import com.porra.mundial.model.Team;
import com.porra.mundial.service.CustomCompetitionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/groups/{leagueId}/competition")
@RequiredArgsConstructor
public class CustomCompetitionController {
    private final CustomCompetitionService service;

    public record TeamItem(Long id, String name) {
        static TeamItem of(Team team) { return new TeamItem(team.getId(), team.getName()); }
    }

    @GetMapping("/teams")
    public List<TeamItem> teams(@PathVariable Long leagueId, Principal principal) {
        return service.teams(leagueId, principal.getName()).stream().map(TeamItem::of).toList();
    }

    @PostMapping("/teams")
    public TeamItem addTeam(@PathVariable Long leagueId, @Valid @RequestBody CustomTeamRequest request, Principal principal) {
        return TeamItem.of(service.addTeam(leagueId, principal.getName(), request.name()));
    }

    @PostMapping("/matches")
    public MatchResponseDTO addMatch(@PathVariable Long leagueId, @Valid @RequestBody CustomMatchRequest request, Principal principal) {
        return service.addMatch(leagueId, principal.getName(), request);
    }

    @PutMapping("/matches/{matchId}/result")
    public MatchResponseDTO setResult(@PathVariable Long leagueId, @PathVariable Long matchId,
                                      @Valid @RequestBody CustomResultRequest request, Principal principal) {
        return service.setResult(leagueId, matchId, principal.getName(), request);
    }
}
