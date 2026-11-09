package app.porrapp.controller;

import app.porrapp.dto.CustomMatchRequest;
import app.porrapp.dto.CustomResultRequest;
import app.porrapp.dto.CustomTeamRequest;
import app.porrapp.dto.MatchResponseDTO;
import app.porrapp.dto.LeagueStandingDTO;
import app.porrapp.dto.MadridDateTimeSerializer;
import app.porrapp.model.PredictionLockMode;
import app.porrapp.service.prediction.CustomLockService;
import app.porrapp.model.Team;
import app.porrapp.service.prediction.CustomCompetitionService;
import app.porrapp.service.tournament.OfficialCompetitionLinkService;
import app.porrapp.sports.EspnNbaDataProvider;
import app.porrapp.util.AppTime;
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
    private final OfficialCompetitionLinkService linkService;
    private final EspnNbaDataProvider nbaProvider;

    public record LinkOfficialRequest(@jakarta.validation.constraints.NotNull Long competitionId) {}

    /** Pasa la liga a una competición oficial con cuadro propio conservando las predicciones. */
    @PostMapping("/link-official")
    public void linkOfficial(@PathVariable Long leagueId, @Valid @RequestBody LinkOfficialRequest request,
                             Principal principal) {
        linkService.link(leagueId, principal.getName(), request.competitionId());
    }

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

    public record LockConfigRequest(PredictionLockMode mode, Integer offsetMinutes, LocalDateTime lockDate) {}

    /** Estado del cierre; las fechas en hora de Madrid con su desfase, como el resto de la API. */
    public record LockStateResponse(String mode, int offsetMinutes, String lockDate, List<String> lockedGroups,
                                    List<List<Boolean>> lockedPicks, boolean anyLocked, boolean fullyLocked,
                                    String nextLockAt, List<KnockoutRoundResponse> knockoutRounds,
                                    String playoffsStart) {
        static LockStateResponse of(CustomLockService.LockState state) {
            return of(state, null);
        }

        /** @param playoffsStart en la NBA sin series aún, cuándo empiezan los playoffs (el play-in) */
        static LockStateResponse of(CustomLockService.LockState state, java.time.Instant playoffsStart) {
            return new LockStateResponse(state.mode().name(), state.offsetMinutes(),
                    MadridDateTimeSerializer.format(state.lockDate()), state.groups(), state.picks(),
                    state.anyLocked(), state.fullyLocked(), MadridDateTimeSerializer.format(state.nextLockAt()),
                    state.knockoutRounds() == null ? null
                            : state.knockoutRounds().stream().map(KnockoutRoundResponse::of).toList(),
                    MadridDateTimeSerializer.format(playoffsStart));
        }
    }

    /**
     * Ronda de unas eliminatorias sorteadas ronda a ronda.
     *
     * @param round        "playoff", "r32", "r16", "qf", "sf" o "final" ("playin" en la NBA)
     * @param drawn        ya se conocen todos sus cruces: se puede pronosticar (en la NBA, cada serie en
     *                     cuanto tiene sus dos equipos)
     * @param expectedTies cruces que tiene la ronda, para pintar los que faltan por sortear
     * @param bestOf       en la NBA, partidos máximos de cada serie (1 en el play-in, 7 en el resto); 0 en fútbol
     * @param ties         cruces en el orden en que se guardan las elecciones
     */
    public record KnockoutRoundResponse(String round, boolean drawn, int expectedTies, int bestOf,
                                        List<KnockoutTieResponse> ties) {
        static KnockoutRoundResponse of(app.porrapp.service.prediction.DrawnKnockout.Round round) {
            return new KnockoutRoundResponse(round.key(), round.drawn(), round.expectedTies(), round.bestOf(),
                    round.ties().stream().map(KnockoutTieResponse::of).toList());
        }
    }

    /**
     * Cruce: el local es el de la ida; {@code matchIds} son sus partidos por fecha y {@code winner}, quién
     * pasa cuando ya se ha decidido. En la NBA, {@code conference} es «E» o «W» (null en las Finales).
     */
    public record KnockoutTieResponse(String home, String away, String winner, List<Long> matchIds,
                                      String conference) {
        static KnockoutTieResponse of(app.porrapp.service.prediction.DrawnKnockout.Tie tie) {
            String home = tie.home() == null ? null : EspnNbaDataProvider.conference(tie.home().getExternalId());
            String away = tie.away() == null ? null : EspnNbaDataProvider.conference(tie.away().getExternalId());
            return new KnockoutTieResponse(name(tie.home()), name(tie.away()), name(tie.winner()),
                    tie.legs().stream().map(app.porrapp.model.Match::getId).toList(),
                    home != null && home.equals(away) ? home : null);
        }

        private static String name(app.porrapp.model.Team team) {
            return team == null || app.porrapp.model.Team.isPlaceholder(team) ? null : team.getName();
        }
    }

    @PutMapping("/lock")
    public LockStateResponse setLockConfig(@PathVariable Long leagueId, @RequestBody LockConfigRequest request,
                                           Principal principal) {
        service.setLockConfig(leagueId, principal.getName(), request.mode(), request.offsetMinutes(),
                AppTime.fromLocal(request.lockDate()));
        return LockStateResponse.of(service.lockState(leagueId, principal.getName()));
    }

    @GetMapping("/lock-state")
    public LockStateResponse lockState(@PathVariable Long leagueId, Principal principal) {
        CustomLockService.LockState state = service.lockState(leagueId, principal.getName());
        boolean noSeriesYet = state.knockoutRounds() != null
                && state.knockoutRounds().stream().allMatch(round -> round.ties().isEmpty());
        // Fuera de los playoffs la liga de la NBA espera a sus series: se dice cuándo empiezan.
        java.time.Instant start = noSeriesYet && service.playsSeries(leagueId, principal.getName())
                ? nbaProvider.nextPlayoffsStart() : null;
        return LockStateResponse.of(state, start);
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

    public record MatchDateRequest(LocalDateTime matchDate) {}

    @PutMapping("/matches/{matchId}/date")
    public MatchResponseDTO setMatchDate(@PathVariable Long leagueId, @PathVariable Long matchId,
                                         @RequestBody MatchDateRequest request, Principal principal) {
        return service.setMatchDate(leagueId, matchId, principal.getName(), AppTime.fromLocal(request.matchDate()));
    }

    @DeleteMapping("/matches/{matchId}")
    public void deleteMatch(@PathVariable Long leagueId, @PathVariable Long matchId,
                            Principal principal) {
        service.deleteMatch(leagueId, matchId, principal.getName());
    }
}
