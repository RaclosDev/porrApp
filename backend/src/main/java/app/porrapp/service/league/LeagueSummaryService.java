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
import app.porrapp.util.MatchRound;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
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

    /** Cuánto atrás se buscan partidos empezados y sin terminar para saber qué jornada está en curso. */
    static final Duration LIVE_WINDOW = Duration.ofDays(1);

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
                // Una liga de marcador no tiene predicciones ni clasificación de porra: su ranking es el del marcador.
                .map(league -> (league.isScoreboard() || league.isTournament() || league.isPoker())
                        ? new LeagueSummaryDTO(league.getId(), null, null, 0, 0, false)
                        : summary(league.getId(), editions.get(league.getId()), email, now))
                .toList();
    }

    private LeagueSummaryDTO summary(Long groupId, Edition edition, String email, Instant now) {
        Prediction prediction = predictionRepository.findByUserGoogleEmailAndEditionLeagueId(email, groupId)
                .orElse(null);
        List<ParticipantScoreDTO> ranking = leaderboardService.getLeaderboard(groupId);
        ParticipantScoreDTO mine = prediction == null ? null : ranking.stream()
                .filter(row -> Objects.equals(row.getId(), prediction.getId()))
                .findFirst().orElse(null);
        // Igual que la clasificación: quien tiene la cuota pendiente no tiene puesto ni cuenta, y los empates
        // comparten puesto sin saltarse números.
        List<ParticipantScoreDTO> paid = ranking.stream().filter(row -> !row.isPending()).toList();
        Integer rank = null;
        Integer points = null;
        if (mine != null) {
            points = mine.getTotal();
            if (!mine.isPending()) {
                rank = 1 + (int) paid.stream().mapToInt(ParticipantScoreDTO::getTotal)
                        .filter(total -> total > mine.getTotal()).distinct().count();
            }
        }
        return new LeagueSummaryDTO(groupId, rank, points, paid.size(),
                pendingPredictions(edition, prediction, now), leagueClosure.isFinished(edition, now));
    }

    /**
     * Partidos de la jornada en curso que aún admiten predicción y el usuario no ha predicho, dentro de la
     * próxima semana. La jornada en curso es la del primer partido sin terminar (aunque ya se esté jugando):
     * la siguiente no avisa hasta que acabe esta. Un aplazado de una jornada anterior también cuenta.
     */
    int pendingPredictions(Edition edition, Prediction prediction, Instant now) {
        if (edition == null || edition.getPoolFormat() != PoolFormat.MATCH_DAY || edition.isLocked()
                || edition.getCompetition() == null) {
            return 0;
        }
        // Con cierre por jornada (o por semana, en la NFL) un partido de dentro de diez días se cierra con el
        // primero de su jornada: se buscan dos ventanas y luego se cuenta lo que se cierra en la próxima semana.
        // Se mira también el último día para dar con el partido en directo que marca la jornada en curso.
        Instant deadline = now.plus(PENDING_WINDOW);
        List<Match> unfinished = MatchSelectionService.competitionIds(matchSelectionService, edition).stream()
                .flatMap(id -> matchRepository.findUnfinishedStartingBetween(id, now.minus(LIVE_WINDOW),
                        deadline.plus(PENDING_WINDOW)).stream())
                .filter(m -> !MatchdayLock.awaitingTeams(m))
                .toList();
        if (MatchSelectionService.selects(edition)) unfinished = matchSelectionService.filter(edition, unfinished);
        Integer current = unfinished.stream()
                .filter(m -> m.getMatchDate() != null)
                .min(Comparator.comparing(Match::getMatchDate))
                .map(m -> MatchRound.matchdayNumber(MatchRound.label(edition, m)))
                .orElse(null);
        List<Match> upcoming = unfinished.stream()
                .filter(m -> m.getMatchDate() != null && m.getMatchDate().isAfter(now))
                .filter(m -> m.getStatus() == null || m.getStatus().isOpenForPrediction())
                .filter(m -> {
                    Integer number = MatchRound.matchdayNumber(MatchRound.label(edition, m));
                    return current == null || number == null || number <= current;
                })
                .toList();
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
