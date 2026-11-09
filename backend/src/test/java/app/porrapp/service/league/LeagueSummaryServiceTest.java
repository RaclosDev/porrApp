package app.porrapp.service.league;

import app.porrapp.service.prediction.LeaderboardService;
import app.porrapp.dto.LeagueSummaryDTO;
import app.porrapp.dto.ParticipantScoreDTO;
import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.MatchPrediction;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.PredictionLockMode;
import app.porrapp.model.Prediction;
import app.porrapp.model.Team;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchPredictionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.PredictionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LeagueSummaryServiceTest {

    private static final String EMAIL = "ana@test.com";

    @Mock private LeagueService leagueService;
    @Mock private LeaderboardService leaderboardService;
    @Mock private EditionRepository editionRepository;
    @Mock private MatchRepository matchRepository;
    @Mock private PredictionRepository predictionRepository;
    @Mock private MatchPredictionRepository matchPredictionRepository;

    @InjectMocks private LeagueSummaryService service;

    private static ParticipantScoreDTO row(long predictionId, int total) {
        return ParticipantScoreDTO.builder().id(predictionId).total(total).build();
    }

    private static Match match(long id, Instant date) {
        return Match.builder().id(id).matchDate(date)
                .homeTeam(Team.builder().name("Local " + id).build())
                .awayTeam(Team.builder().name("Visitante " + id).build())
                .build();
    }

    @Test
    @DisplayName("Da la posición con empates, los puntos y los partidos abiertos sin predicción")
    void summarisesRankPointsAndPendingPredictions() {
        League league = League.builder().id(7L).name("Liga").build();
        Competition competition = Competition.builder().id(3L).build();
        Edition edition = Edition.builder().league(league).competition(competition)
                .poolFormat(PoolFormat.MATCH_DAY).status("ACTIVE").build();
        Prediction mine = Prediction.builder().id(21L).build();
        Instant soon = Instant.now().plus(Duration.ofDays(2));

        when(leagueService.getUserLeagues(EMAIL)).thenReturn(List.of(league));
        when(editionRepository.findByLeagueIdInAndStatus(List.of(7L), "ACTIVE")).thenReturn(List.of(edition));
        when(predictionRepository.findByUserGoogleEmailAndEditionLeagueId(EMAIL, 7L)).thenReturn(Optional.of(mine));
        when(leaderboardService.getLeaderboard(7L)).thenReturn(List.of(row(20L, 50), row(22L, 30), row(21L, 30)));
        when(matchRepository.findUnfinishedStartingBetween(eq(3L), any(), any()))
                .thenReturn(List.of(match(1L, soon), match(2L, soon), match(3L, soon)));
        when(matchPredictionRepository.findByPredictionIdAndMatchIdIn(eq(21L), anyCollection()))
                .thenReturn(List.of(MatchPrediction.builder().homeScore(1).awayScore(0).build()));

        List<LeagueSummaryDTO> result = service.summaries(EMAIL);

        assertThat(result).containsExactly(new LeagueSummaryDTO(7L, 2, 30, 3, 2));
    }

    @Test
    @DisplayName("Con cierre por jornada cuenta los partidos que se cierran esta semana, aunque se jueguen después")
    void perRoundCountsWhatLocksThisWeek() {
        League league = League.builder().id(9L).name("NFL").build();
        Competition competition = Competition.builder().id(14L).externalId("nfl").build();
        Edition edition = Edition.builder().league(league).competition(competition)
                .poolFormat(PoolFormat.MATCH_DAY).lockMode(PredictionLockMode.PER_ROUND).lockOffsetMinutes(0)
                .status("ACTIVE").build();
        Instant now = Instant.now();
        Match thursday = match(1L, now.plus(Duration.ofDays(5)));
        thursday.setRound("Semana 10");
        Match monday = match(2L, now.plus(Duration.ofDays(9)));
        monday.setRound("Semana 10");
        Match later = match(3L, now.plus(Duration.ofDays(12)));
        later.setRound("Semana 11");

        when(leagueService.getUserLeagues(EMAIL)).thenReturn(List.of(league));
        when(editionRepository.findByLeagueIdInAndStatus(List.of(9L), "ACTIVE")).thenReturn(List.of(edition));
        when(predictionRepository.findByUserGoogleEmailAndEditionLeagueId(EMAIL, 9L)).thenReturn(Optional.empty());
        when(leaderboardService.getLeaderboard(9L)).thenReturn(List.of());
        when(matchRepository.findUnfinishedStartingBetween(eq(14L), any(), any()))
                .thenReturn(List.of(thursday, monday, later));
        when(matchRepository.findByCompetitionId(14L)).thenReturn(List.of(thursday, monday, later));

        // El del lunes se cierra el jueves con su semana; la semana 11 aún no toca.
        assertThat(service.summaries(EMAIL).get(0).pendingPredictions()).isEqualTo(2);
    }

    @Test
    @DisplayName("Sin predicción en una liga de cuadro no hay posición ni pendientes")
    void bracketLeagueWithoutPredictionHasNoRank() {
        League league = League.builder().id(8L).name("Cuadro").build();
        Edition edition = Edition.builder().league(league).competition(Competition.builder().id(4L).build())
                .poolFormat(PoolFormat.FULL_BRACKET).status("ACTIVE").build();

        when(leagueService.getUserLeagues(EMAIL)).thenReturn(List.of(league));
        when(editionRepository.findByLeagueIdInAndStatus(anyList(), eq("ACTIVE"))).thenReturn(List.of(edition));
        when(predictionRepository.findByUserGoogleEmailAndEditionLeagueId(EMAIL, 8L)).thenReturn(Optional.empty());
        when(leaderboardService.getLeaderboard(8L)).thenReturn(List.of(row(30L, 10)));

        assertThat(service.summaries(EMAIL)).containsExactly(new LeagueSummaryDTO(8L, null, null, 1, 0));
    }
}
