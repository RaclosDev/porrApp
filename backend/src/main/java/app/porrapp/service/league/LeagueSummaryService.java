package app.porrapp.service.league;

import app.porrapp.service.prediction.MatchSelectionService;
import app.porrapp.service.prediction.MatchdayLock;
import app.porrapp.service.prediction.LeaderboardService;
import app.porrapp.dto.LeagueSummaryDTO;
import app.porrapp.dto.ParticipantScoreDTO;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.Prediction;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchPredictionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.PredictionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Posición, puntos y predicciones pendientes del usuario en cada una de sus ligas. */
@Service
@RequiredArgsConstructor
public class LeagueSummaryService {

    /** Ventana de partidos que cuentan como pendientes: los de la próxima semana. */
    static final Duration PENDING_WINDOW = Duration.ofDays(7);

    private final LeagueService leagueService;
    private final LeaderboardService leaderboardService;
    private final EditionRepository editionRepository;
    private final MatchRepository matchRepository;
    private final PredictionRepository predictionRepository;
    private final MatchPredictionRepository matchPredictionRepository;
    private final MatchSelectionService matchSelectionService;
    private final LeagueClosure leagueClosure;

    @Transactional(readOnly = true)
    public List<LeagueSummaryDTO> summaries(String email) {
        List<League> leagues = leagueService.getUserLeagues(email);
        if (leagues.isEmpty()) return List.of();
        List<Long> ids = leagues.stream().map(League::getId).toList();
        Map<Long, Edition> editions = editionRepository.findByLeagueIdInAndStatus(ids, "ACTIVE").stream()
                .collect(Collectors.toMap(e -> e.getLeague().getId(), Function.identity(), (a, b) -> a));
        Instant now = Instant.now();
        return leagues.stream()
                .map(league -> summary(league.getId(), editions.get(league.getId()), email, now))
                .toList();
    }

    private LeagueSummaryDTO summary(Long groupId, Edition edition, String email, Instant now) {
        Prediction prediction = predictionRepository.findByUserGoogleEmailAndEditionLeagueId(email, groupId)
                .orElse(null);
        List<ParticipantScoreDTO> ranking = leaderboardService.getLeaderboard(groupId);
        ParticipantScoreDTO mine = prediction == null ? null : ranking.stream()
                .filter(row -> Objects.equals(row.getId(), prediction.getId()))
                .findFirst().orElse(null);
        Integer rank = null;
        Integer points = null;
        if (mine != null) {
            points = mine.getTotal();
            rank = 1 + (int) ranking.stream().filter(row -> row.getTotal() > mine.getTotal()).count();
        }
        return new LeagueSummaryDTO(groupId, rank, points, ranking.size(),
                pendingPredictions(edition, prediction, now), leagueClosure.isFinished(edition, now));
    }

    /** Partidos de la próxima semana que aún admiten predicción y el usuario no ha predicho. */
    int pendingPredictions(Edition edition, Prediction prediction, Instant now) {
        if (edition == null || edition.getPoolFormat() != PoolFormat.MATCH_DAY || edition.isLocked()
                || edition.getCompetition() == null) {
            return 0;
        }
        // Con cierre por jornada (o por semana, en la NFL) un partido de dentro de diez días se cierra con el
        // primero de su jornada: se buscan dos ventanas y luego se cuenta lo que se cierra en la próxima semana.
        Instant deadline = now.plus(PENDING_WINDOW);
        List<Match> upcoming = MatchSelectionService.competitionIds(matchSelectionService, edition).stream()
                .flatMap(id -> matchRepository.findUnfinishedStartingBetween(id, now, deadline.plus(PENDING_WINDOW)).stream())
                .filter(m -> !MatchdayLock.awaitingTeams(m))
                .filter(m -> m.getStatus() == null || m.getStatus().isOpenForPrediction())
                .toList();
        if (MatchSelectionService.selects(edition)) upcoming = matchSelectionService.filter(edition, upcoming);
        if (upcoming.isEmpty()) return 0;
        Map<Long, Instant> lockTimes = MatchdayLock.lockTimes(edition, upcoming,
                MatchdayLock.needsWholeCalendar(edition) ? MatchSelectionService.leagueCalendar(matchSelectionService, edition, matchRepository::findByCompetitionId) : upcoming);
        List<Long> open = upcoming.stream()
                .filter(m -> {
                    Instant lock = lockTimes.getOrDefault(m.getId(), m.getMatchDate());
                    return lock == null || lock.isAfter(now) && lock.isBefore(deadline);
                })
                .map(Match::getId)
                .toList();
        if (open.isEmpty()) return 0;
        if (prediction == null) return open.size();
        long predicted = matchPredictionRepository.findByPredictionIdAndMatchIdIn(prediction.getId(), open).stream()
                .filter(mp -> mp.getHomeScore() != null || mp.getPredictionSign() != null)
                .count();
        return (int) Math.max(0, open.size() - predicted);
    }
}
