package com.porra.mundial.controller;

import com.porra.mundial.dto.CustomMatchRequest;
import com.porra.mundial.dto.CustomResultRequest;
import com.porra.mundial.dto.CustomTeamRequest;
import com.porra.mundial.dto.MatchResponseDTO;
import com.porra.mundial.dto.LeagueStandingDTO;
import com.porra.mundial.model.Team;
import com.porra.mundial.service.CustomCompetitionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/groups/{leagueId}/competition")
@RequiredArgsConstructor
public class CustomCompetitionController {
    private final CustomCompetitionService service;

    public record TeamItem(Long id, String name, String groupName, String logoUrl) {
        static TeamItem of(Team team) {
            return new TeamItem(team.getId(), team.getName(), team.getGroupName(), team.getLogoUrl());
        }
    }

    @GetMapping("/teams")
    public List<TeamItem> teams(@PathVariable Long leagueId, Principal principal) {
        return service.teams(leagueId, principal.getName()).stream().map(TeamItem::of).toList();
    }

    @GetMapping("/matches")
    public List<MatchResponseDTO> matches(@PathVariable Long leagueId, Principal principal) {
        return service.matches(leagueId, principal.getName());
    }

    @GetMapping("/standings")
    public List<LeagueStandingDTO> standings(@PathVariable Long leagueId, Principal principal) {
        return service.standings(leagueId, principal.getName());
    }

    @PostMapping("/teams")
    public TeamItem addTeam(@PathVariable Long leagueId, @Valid @RequestBody CustomTeamRequest request, Principal principal) {
        return TeamItem.of(service.addTeam(leagueId, principal.getName(), request.name(), request.groupName(),
                request.logoUrl()));
    }

    public record TeamLogoRequest(@Size(max = 500) String logoUrl) {}

    @PutMapping("/teams/{teamId}/logo")
    public TeamItem setTeamLogo(@PathVariable Long leagueId, @PathVariable Long teamId,
                                @Valid @RequestBody TeamLogoRequest request, Principal principal) {
        return TeamItem.of(service.setTeamLogo(leagueId, teamId, principal.getName(), request.logoUrl()));
    }

    @DeleteMapping("/teams/{teamId}")
    public void deleteTeam(@PathVariable Long leagueId, @PathVariable Long teamId,
                           Principal principal) {
        service.deleteTeam(leagueId, teamId, principal.getName());
    }

    public record LockDateRequest(LocalDateTime lockDate) {}

    @PutMapping("/lock-date")
    public LocalDateTime setLockDate(@PathVariable Long leagueId,
                                     @RequestBody LockDateRequest request, Principal principal) {
        return service.setLockDate(leagueId, principal.getName(), request.lockDate());
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

    @DeleteMapping("/matches/{matchId}")
    public void deleteMatch(@PathVariable Long leagueId, @PathVariable Long matchId,
                            Principal principal) {
        service.deleteMatch(leagueId, matchId, principal.getName());
    }
}
