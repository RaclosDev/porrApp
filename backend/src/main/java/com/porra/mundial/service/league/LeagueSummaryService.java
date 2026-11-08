package com.porra.mundial.service.league;

import com.porra.mundial.service.prediction.MatchSelectionService;
import com.porra.mundial.service.prediction.MatchdayLock;
import com.porra.mundial.service.prediction.LeaderboardService;
import com.porra.mundial.dto.LeagueSummaryDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.PredictionRepository;
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
                pendingPredictions(edition, prediction, now));
    }

    /** Partidos de la próxima semana que aún admiten predicción y el usuario no ha predicho. */
    int pendingPredictions(Edition edition, Prediction prediction, Instant now) {
        if (edition == null || edition.getPoolFormat() != PoolFormat.MATCH_DAY || edition.isLocked()
                || edition.getCompetition() == null) {
            return 0;
        }
        List<Match> upcoming = MatchSelectionService.competitionIds(matchSelectionService, edition).stream()
                .flatMap(id -> matchRepository.findUnfinishedStartingBetween(id, now, now.plus(PENDING_WINDOW)).stream())
                .filter(m -> !MatchdayLock.awaitingTeams(m))
                .filter(m -> m.getStatus() == null || m.getStatus().isOpenForPrediction())
                .toList();
        if (MatchSelectionService.selects(edition)) upcoming = matchSelectionService.filter(edition, upcoming);
        if (upcoming.isEmpty()) return 0;
        Map<Long, Instant> lockTimes = MatchdayLock.lockTimes(edition, upcoming,
                MatchdayLock.needsWholeCalendar(edition) ? MatchSelectionService.leagueCalendar(matchSelectionService, edition, matchRepository::findByCompetitionId) : upcoming);
        List<Long> open = upcoming.stream()
                .filter(m -> !lockTimes.containsKey(m.getId()) || lockTimes.get(m.getId()).isAfter(now))
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
