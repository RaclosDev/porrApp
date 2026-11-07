package com.porra.mundial.service.prediction;

import com.porra.mundial.service.league.LeagueService;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.dto.MatchVotersDTO;
import com.porra.mundial.dto.MatchVotersDTO.Voter;
import com.porra.mundial.dto.MatchdayStatsDTO;
import com.porra.mundial.dto.MatchdayStatsDTO.MatchStats;
import com.porra.mundial.dto.MatchdayStatsDTO.ScoreCount;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchPrediction;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.Team;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.util.MatchRound;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

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

    /** Partidos por petición de votantes: los de una jornada larga caben de sobra. */
    static final int MAX_VOTER_MATCHES = 60;

    private final LeagueService leagueService;
    private final EditionRepository editionRepository;
    private final MatchPredictionRepository matchPredictionRepository;
    private final MembershipRepository membershipRepository;
    private final MatchRepository matchRepository;
    private final PredictionRepository predictionRepository;
    private final CustomLockService customLockService;
    private final MatchSelectionService matchSelectionService;

    @Transactional(readOnly = true)
    public MatchdayStatsDTO getStats(String email, Long groupId) {
        if (groupId == null) {
            throw BusinessException.badRequest("El grupo es obligatorio");
        }
        leagueService.assertCanView(groupId, email);

        Edition edition = editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE").orElse(null);
        if (edition == null || edition.getPoolFormat() != PoolFormat.MATCH_DAY) {
            return new MatchdayStatsDTO(0, List.of());
        }

        Instant now = Instant.now();
        boolean editionLocked = edition.isLocked();
        List<MatchPrediction> all = matchPredictionRepository.findWithMatchByEditionId(edition.getId());
        List<Match> predicted = all.stream().map(MatchPrediction::getMatch)
                .filter(match -> match != null && match.getId() != null).distinct().toList();
        Map<Long, Instant> lockTimes = MatchdayLock.lockTimes(edition, predicted,
                MatchdayLock.needsWholeCalendar(edition) && edition.getCompetition() != null
                        ? MatchSelectionService.leagueCalendar(matchSelectionService, edition,
                                matchRepository.findByCompetitionId(edition.getCompetition().getId())) : predicted);
        Map<Long, List<MatchPrediction>> byMatch = new LinkedHashMap<>();
        for (MatchPrediction mp : all) {
            Match match = mp.getMatch();
            if (match != null && match.getId() != null
                    && isRevealed(match, lockTimes.get(match.getId()), editionLocked, now)) {
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

    /**
     * Quién ha pronosticado cada signo en los partidos pedidos cuyos pronósticos ya se ven. Los partidos
     * aún abiertos no aparecen, y solo cuentan los miembros actuales de la liga.
     */
    @Transactional(readOnly = true)
    public List<MatchVotersDTO> getVoters(String email, Long groupId, List<Long> matchIds) {
        if (groupId == null) {
            throw BusinessException.badRequest("El grupo es obligatorio");
        }
        if (matchIds == null || matchIds.isEmpty()) return List.of();
        if (matchIds.size() > MAX_VOTER_MATCHES) {
            throw BusinessException.badRequest("Demasiados partidos a la vez");
        }
        leagueService.assertCanView(groupId, email);

        Edition edition = editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE").orElse(null);
        if (edition == null) return List.of();
        if (PredictableBracket.applies(edition)) return bracketVoters(edition, groupId, matchIds);
        if (!PoolFormat.isMatchBased(edition.getPoolFormat())) return List.of();

        List<MatchPrediction> all = matchPredictionRepository
                .findWithUserByEditionIdAndMatchIds(edition.getId(), new LinkedHashSet<>(matchIds));
        if (all.isEmpty()) return List.of();
        Set<Long> members = memberIds(groupId);
        List<Match> matches = all.stream().map(MatchPrediction::getMatch).distinct().toList();
        Map<Long, Instant> lockTimes = MatchdayLock.lockTimes(edition, matches,
                MatchdayLock.needsWholeCalendar(edition) && edition.getCompetition() != null
                        ? MatchSelectionService.leagueCalendar(matchSelectionService, edition,
                                matchRepository.findByCompetitionId(edition.getCompetition().getId())) : matches);

        Instant now = Instant.now();
        Map<Long, Map<String, Map<Long, Voter>>> byMatch = new LinkedHashMap<>();
        for (MatchPrediction mp : all) {
            Match match = mp.getMatch();
            UserAccount user = mp.getPrediction().getUser();
            if (user == null || !members.contains(user.getId())
                    || !isRevealed(match, lockTimes.get(match.getId()), edition.isLocked(), now)) {
                continue;
            }
            boolean hasScore = mp.getHomeScore() != null && mp.getAwayScore() != null;
            String sign = hasScore ? sign(mp.getHomeScore(), mp.getAwayScore()) : normalizeSign(mp.getPredictionSign());
            if (sign == null) continue;
            byMatch.computeIfAbsent(match.getId(), id -> new HashMap<>())
                    .computeIfAbsent(sign, s -> new LinkedHashMap<>())
                    .putIfAbsent(user.getId(), voter(user));
        }

        List<MatchVotersDTO> result = new ArrayList<>();
        for (Long matchId : new LinkedHashSet<>(matchIds)) {
            Map<String, Map<Long, Voter>> signs = byMatch.get(matchId);
            if (signs == null) continue;
            result.add(new MatchVotersDTO(matchId, voters(signs, "1"), voters(signs, "X"), voters(signs, "2")));
        }
        return result;
    }

    /**
     * Los miembros de la liga que ya han hecho alguna predicción en los partidos pedidos (una jornada).
     * Solo dice quién ha participado, nunca qué ha pronosticado, así que vale también antes del cierre.
     * Se limita a los miembros: quien mira una liga pública sin ser miembro no recibe la lista.
     */
    @Transactional(readOnly = true)
    public List<Voter> getParticipants(String email, Long groupId, List<Long> matchIds) {
        if (groupId == null) {
            throw BusinessException.badRequest("El grupo es obligatorio");
        }
        if (matchIds == null || matchIds.isEmpty()) return List.of();
        if (matchIds.size() > MAX_VOTER_MATCHES) {
            throw BusinessException.badRequest("Demasiados partidos a la vez");
        }
        leagueService.assertCanView(groupId, email);
        if (!leagueService.isUserMemberOrAdmin(groupId, email)) return List.of();

        Edition edition = editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE").orElse(null);
        if (edition == null || !PoolFormat.isMatchBased(edition.getPoolFormat())) return List.of();

        Set<Long> members = memberIds(groupId);
        Map<Long, Voter> participants = new LinkedHashMap<>();
        for (MatchPrediction mp : matchPredictionRepository
                .findWithUserByEditionIdAndMatchIds(edition.getId(), new LinkedHashSet<>(matchIds))) {
            UserAccount user = mp.getPrediction().getUser();
            boolean predicted = (mp.getHomeScore() != null && mp.getAwayScore() != null)
                    || normalizeSign(mp.getPredictionSign()) != null;
            if (user != null && predicted && members.contains(user.getId())) {
                participants.putIfAbsent(user.getId(), voter(user));
            }
        }
        return participants.values().stream()
                .sorted(Comparator.comparing(Voter::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    /**
     * En las ligas de cuadro cada miembro elige quién gana cada cruce: aparece bajo el equipo que pasa
     * en su cuadro. Solo se ven los cruces cuyo pronóstico ya está cerrado, como en el cuadro de los demás.
     */
    private List<MatchVotersDTO> bracketVoters(Edition edition, Long groupId, List<Long> matchIds) {
        List<List<Match>> rounds = PredictableBracket.rounds(edition.getCompetition(),
                matchRepository.findByCompetitionId(edition.getCompetition().getId()));
        Map<Long, int[]> positions = new HashMap<>();
        for (int round = 0; round < rounds.size(); round++) {
            for (int index = 0; index < rounds.get(round).size(); index++) {
                positions.put(rounds.get(round).get(index).getId(), new int[]{round, index});
            }
        }
        CustomLockService.LockState lock = customLockService.state(edition);
        Instant now = Instant.now();
        List<Match> requested = new ArrayList<>();
        for (Long matchId : new LinkedHashSet<>(matchIds)) {
            int[] at = positions.get(matchId);
            if (at == null) continue;
            Match match = rounds.get(at[0]).get(at[1]);
            if (match.getHomeTeam() == null || match.getAwayTeam() == null) continue;
            if (lock.fullyLocked() || lock.pickLocked(at[0], at[1])
                    || isRevealed(match, null, edition.isLocked(), now)) {
                requested.add(match);
            }
        }
        if (requested.isEmpty()) return List.of();

        Set<Long> members = memberIds(groupId);
        List<Prediction> predictions = predictionRepository.findByEditionLeagueIdWithUserAndEdition(groupId).stream()
                .filter(p -> p.getEdition() != null && edition.getId().equals(p.getEdition().getId()))
                .filter(p -> p.getUser() != null && members.contains(p.getUser().getId()))
                .filter(p -> p.getBracketData() != null && p.getBracketData().getCustomRounds() != null)
                .toList();

        List<MatchVotersDTO> result = new ArrayList<>();
        for (Match match : requested) {
            int[] at = positions.get(match.getId());
            String home = match.getHomeTeam().getName();
            String away = match.getAwayTeam().getName();
            Map<String, Map<Long, Voter>> sides = new HashMap<>();
            for (Prediction prediction : predictions) {
                String side = bracketSide(prediction.getBracketData().getCustomRounds(), at[0], at[1], home, away);
                if (side == null) continue;
                UserAccount user = prediction.getUser();
                sides.computeIfAbsent(side, s -> new LinkedHashMap<>()).putIfAbsent(user.getId(), voter(user));
            }
            if (!sides.isEmpty()) {
                result.add(new MatchVotersDTO(match.getId(), voters(sides, "1"), List.of(), voters(sides, "2")));
            }
        }
        return result;
    }

    /**
     * El lado que pasa en un cuadro pronosticado: el elegido en esa misma casilla o, si el cuadro del
     * miembro llegó a la ronda por otro camino, el único de los dos que tenga pasando en esa ronda.
     */
    static String bracketSide(List<List<String>> picks, int round, int index, String home, String away) {
        if (round >= picks.size() || picks.get(round) == null) return null;
        List<String> roundPicks = picks.get(round);
        String pick = index < roundPicks.size() ? roundPicks.get(index) : null;
        if (home.equals(pick)) return "1";
        if (away.equals(pick)) return "2";
        boolean homeAdvances = roundPicks.contains(home);
        boolean awayAdvances = roundPicks.contains(away);
        if (homeAdvances == awayAdvances) return null;
        return homeAdvances ? "1" : "2";
    }

    private Set<Long> memberIds(Long groupId) {
        Set<Long> members = new HashSet<>();
        for (Membership membership : membershipRepository.findByLeagueId(groupId)) {
            if (membership.getUser() != null) members.add(membership.getUser().getId());
        }
        return members;
    }

    private static Voter voter(UserAccount user) {
        return new Voter(user.getId(),
                user.getParticipantName() != null ? user.getParticipantName() : "Anónimo", user.getAvatarUrl());
    }

    private static List<Voter> voters(Map<String, Map<Long, Voter>> signs, String sign) {
        return signs.getOrDefault(sign, Map.of()).values().stream()
                .sorted(Comparator.comparing(Voter::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    /** Los pronósticos de un partido se ven cuando se cierran, termina el partido o se cierra la porra. */
    static boolean isRevealed(Match match, Instant lockAt, boolean editionLocked, Instant now) {
        return editionLocked
                || Boolean.TRUE.equals(match.getFinished())
                || (match.getStatus() != null && !match.getStatus().isOpenForPrediction())
                || (lockAt != null && !lockAt.isAfter(now));
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
