package com.porra.mundial.service;

import com.porra.mundial.dto.MatchdayStatsDTO;
import com.porra.mundial.dto.MatchdayStatsDTO.MatchStats;
import com.porra.mundial.dto.MatchdayStatsDTO.ScoreCount;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchPrediction;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.util.MatchRound;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Estadísticas de las ligas por jornadas: cómo ha pronosticado la liga cada partido.
 * <p>
 * Solo agrega partidos que ya han empezado (o de una porra cerrada), con la misma regla que
 * revela los pronósticos de los demás en {@link MatchPredictionService#getFriendPredictionsForMatch}.
 */
@Service
@RequiredArgsConstructor
public class MatchdayStatsService {

    /** Marcadores que se devuelven por partido. */
    static final int TOP_SCORES = 3;

    private final GroupService groupService;
    private final EditionRepository editionRepository;
    private final MatchPredictionRepository matchPredictionRepository;
    private final MembershipRepository membershipRepository;

    @Transactional(readOnly = true)
    public MatchdayStatsDTO getStats(String email, Long groupId) {
        if (groupId == null) {
            throw new IllegalArgumentException("El grupo es obligatorio");
        }
        groupService.assertCanView(groupId, email);

        Edition edition = editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE").orElse(null);
        if (edition == null || edition.getPoolFormat() != PoolFormat.MATCH_DAY) {
            return new MatchdayStatsDTO(0, List.of());
        }

        LocalDateTime now = LocalDateTime.now();
        boolean editionLocked = edition.isLocked();
        Map<Long, List<MatchPrediction>> byMatch = new LinkedHashMap<>();
        for (MatchPrediction mp : matchPredictionRepository.findWithMatchByEditionId(edition.getId())) {
            Match match = mp.getMatch();
            if (match != null && match.getId() != null && isRevealed(match, editionLocked, now)) {
                byMatch.computeIfAbsent(match.getId(), id -> new ArrayList<>()).add(mp);
            }
        }

        List<MatchStats> matches = byMatch.values().stream()
                .map(MatchdayStatsService::aggregate)
                .sorted(Comparator.comparing(MatchStats::matchDate, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(MatchStats::matchId))
                .toList();
        return new MatchdayStatsDTO(membershipRepository.countByLeagueId(groupId), matches);
    }

    /** Los pronósticos de un partido se ven cuando empieza, termina o se cierra la porra. */
    static boolean isRevealed(Match match, boolean editionLocked, LocalDateTime now) {
        return editionLocked
                || Boolean.TRUE.equals(match.getFinished())
                || (match.getStatus() != null && !match.getStatus().isOpenForPrediction())
                || (match.getMatchDate() != null && !match.getMatchDate().isAfter(now));
    }

    private static MatchStats aggregate(List<MatchPrediction> predictions) {
        Match match = predictions.get(0).getMatch();
        boolean finished = Boolean.TRUE.equals(match.getFinished())
                && match.getHomeScore() != null && match.getAwayScore() != null;
        String realSign = finished ? sign(match.getHomeScore(), match.getAwayScore()) : null;

        int homeWins = 0;
        int draws = 0;
        int awayWins = 0;
        int exactHits = 0;
        int signHits = 0;
        Map<String, ScoreCount> scores = new LinkedHashMap<>();
        for (MatchPrediction mp : predictions) {
            boolean hasScore = mp.getHomeScore() != null && mp.getAwayScore() != null;
            String sign = hasScore ? sign(mp.getHomeScore(), mp.getAwayScore()) : normalizeSign(mp.getPredictionSign());
            if ("1".equals(sign)) homeWins++;
            else if ("X".equals(sign)) draws++;
            else if ("2".equals(sign)) awayWins++;

            if (hasScore) {
                scores.merge(mp.getHomeScore() + "-" + mp.getAwayScore(),
                        new ScoreCount(mp.getHomeScore(), mp.getAwayScore(), 1),
                        (a, b) -> new ScoreCount(a.home(), a.away(), a.count() + 1));
                if (finished && mp.getHomeScore().equals(match.getHomeScore())
                        && mp.getAwayScore().equals(match.getAwayScore())) {
                    exactHits++;
                }
            }
            if (realSign != null && realSign.equals(sign)) signHits++;
        }

        List<ScoreCount> topScores = scores.values().stream()
                .sorted(Comparator.comparingInt(ScoreCount::count).reversed()
                        .thenComparingInt(ScoreCount::home)
                        .thenComparingInt(ScoreCount::away))
                .limit(TOP_SCORES)
                .toList();

        return new MatchStats(
                match.getId(),
                MatchRound.label(match),
                match.getMatchDate(),
                teamName(match.getHomeTeam()),
                teamName(match.getAwayTeam()),
                match.getHomeTeam() != null ? match.getHomeTeam().getLogoUrl() : null,
                match.getAwayTeam() != null ? match.getAwayTeam().getLogoUrl() : null,
                finished,
                match.getStatus() != null && match.getStatus().isLive(),
                match.getHomeScore(),
                match.getAwayScore(),
                predictions.size(),
                homeWins,
                draws,
                awayWins,
                topScores,
                finished ? exactHits : null,
                finished ? signHits : null);
    }

    private static String sign(int home, int away) {
        return home > away ? "1" : home == away ? "X" : "2";
    }

    private static String normalizeSign(String sign) {
        if (sign == null) return null;
        String s = sign.trim().toUpperCase();
        return "1".equals(s) || "X".equals(s) || "2".equals(s) ? s : null;
    }

    private static String teamName(Team team) {
        return team != null ? team.getName() : Team.PLACEHOLDER_NAME;
    }
}
