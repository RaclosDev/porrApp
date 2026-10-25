package com.porra.mundial.service;

import com.porra.mundial.dto.MatchPredictionItemDTO;
import com.porra.mundial.dto.MatchdayFixturePredictionDTO;
import com.porra.mundial.dto.MatchdayFriendBetDTO;
import com.porra.mundial.model.*;
import com.porra.mundial.repository.*;
import com.porra.mundial.scoring.MatchScoreResult;
import com.porra.mundial.scoring.MatchScoringCalculator;
import com.porra.mundial.scoring.ScoringRuleSet;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Servicio de Pronósticos por Jornada y Partido Directo (Matchday).
 * Gestiona el ciclo de vida de los pronósticos 1X2 y marcador exacto,
 * con bloqueo individual por fecha de inicio de partido y cálculo determinista.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MatchPredictionService {

    private final MatchRepository matchRepository;
    private final MatchPredictionRepository matchPredictionRepository;
    private final PredictionRepository predictionRepository;
    private final UserAccountRepository userAccountRepository;
    private final EditionRepository editionRepository;
    private final MembershipRepository membershipRepository;
    private final MatchScoringCalculator matchScoringCalculator;

    /**
     * Devuelve los partidos del calendario junto con los pronósticos del usuario y su estado de bloqueo.
     */
    @Transactional(readOnly = true)
    public List<MatchdayFixturePredictionDTO> getMatchdayFixtures(String email, Long groupId, String round) {
        if (groupId != null && !Long.valueOf(1L).equals(groupId)) {
            boolean isMember = false;
            if (email != null && !email.isBlank()) {
                UserAccount user = userAccountRepository.findByGoogleEmail(email)
                        .or(() -> userAccountRepository.findByParticipantNameIgnoreCase(email))
                        .orElse(null);
                if (user != null) {
                    if (user.isSuperadmin()) {
                        isMember = true;
                    } else {
                        Membership.MembershipId memId = new Membership.MembershipId(user.getId(), groupId);
                        isMember = membershipRepository.existsById(memId);
                    }
                }
            }
            if (!isMember) {
                throw new SecurityException("No perteneces a esta liga privada.");
            }
        }
        Edition edition = groupId != null
                ? editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE").orElse(null)
                : null;

        List<Match> matches;
        if (edition != null && edition.getCompetition() != null) {
            matches = matchRepository.findByCompetitionIdOrderByMatchDateAsc(edition.getCompetition().getId());
        } else {
            matches = matchRepository.findAll().stream()
                    .sorted(Comparator.comparing(m -> m.getMatchDate() != null ? m.getMatchDate() : LocalDateTime.MAX))
                    .collect(Collectors.toList());
        }

        if (round != null && !round.isBlank()) {
            final String cleanRound = round.trim();
            final String groupOnly = cleanRound.toLowerCase().startsWith("grupo ")
                    ? cleanRound.substring(6).trim()
                    : cleanRound;
            matches = matches.stream()
                    .filter(m -> cleanRound.equalsIgnoreCase(m.getRound())
                            || cleanRound.equalsIgnoreCase(m.getGroupName())
                            || (m.getGroupName() != null && groupOnly.equalsIgnoreCase(m.getGroupName())))
                    .collect(Collectors.toList());
        }

        // Excluir partidos fantasma donde ambos equipos son 'Por definir'
        matches = matches.stream()
                .filter(m -> {
                    if (m.getHomeTeam() == null || m.getAwayTeam() == null) return true;
                    boolean h = "Por definir".equalsIgnoreCase(m.getHomeTeam().getName()) || "TBD".equalsIgnoreCase(m.getHomeTeam().getNameEn());
                    boolean a = "Por definir".equalsIgnoreCase(m.getAwayTeam().getName()) || "TBD".equalsIgnoreCase(m.getAwayTeam().getNameEn());
                    return !(h && a);
                })
                .collect(Collectors.toList());

        Prediction userPrediction = null;
        if (email != null && !email.isBlank() && groupId != null) {
            userPrediction = predictionRepository.findByUserGoogleEmailAndEditionLeagueId(email, groupId).orElse(null);
        }

        Map<Long, MatchPrediction> predictionMap = new HashMap<>();
        if (userPrediction != null) {
            List<MatchPrediction> userPredictions = matchPredictionRepository.findByPredictionId(userPrediction.getId());
            for (MatchPrediction mp : userPredictions) {
                if (mp.getMatch() != null) {
                    predictionMap.put(mp.getMatch().getId(), mp);
                }
            }
        }

        ScoringRuleSet rules = edition != null
                ? ScoringRuleSet.fromJson(edition.getScoringRulesJson())
                : ScoringRuleSet.defaultWorldCup2026();

        LocalDateTime now = LocalDateTime.now();
        List<MatchdayFixturePredictionDTO> result = new ArrayList<>();

        for (Match match : matches) {
            MatchPrediction mp = predictionMap.get(match.getId());

            boolean isLocked = false;
            String lockReason = "Abierto";

            if (edition != null && edition.isLocked()) {
                isLocked = true;
                lockReason = "La porra ha finalizado su plazo de inscripción general";
            } else if (Boolean.TRUE.equals(match.getFinished())) {
                isLocked = true;
                lockReason = "El partido ya ha finalizado";
            } else if (match.getMatchDate() != null && match.getMatchDate().isBefore(now)) {
                isLocked = true;
                lockReason = "El partido ya ha comenzado";
            }

            Integer pointsAwarded = null;
            Boolean isExact = null;
            Boolean isCorrectSign = null;
            String scoringDetails = null;

            if (mp != null) {
                pointsAwarded = mp.getPointsAwarded();
                isExact = mp.getIsExactScore();
                isCorrectSign = mp.getIsCorrectSign();
                scoringDetails = mp.getScoringDetails();

                // Si el partido está terminado o tiene marcador oficial y no se había evaluado
                if ((Boolean.TRUE.equals(match.getFinished()) || match.getHomeScore() != null)
                        && match.getHomeScore() != null && match.getAwayScore() != null
                        && mp.getHomeScore() != null && mp.getAwayScore() != null) {
                    MatchScoreResult scoreResult = matchScoringCalculator.calculate(
                            mp.getHomeScore(), mp.getAwayScore(),
                            match.getHomeScore(), match.getAwayScore(),
                            rules
                    );
                    pointsAwarded = scoreResult.totalPoints();
                    isExact = scoreResult.exactScore();
                    isCorrectSign = scoreResult.correctSign();
                    scoringDetails = scoreResult.explanation();
                }
            }

            result.add(MatchdayFixturePredictionDTO.builder()
                    .matchId(match.getId())
                    .homeTeam(match.getHomeTeam() != null ? match.getHomeTeam().getName() : "Por definir")
                    .awayTeam(match.getAwayTeam() != null ? match.getAwayTeam().getName() : "Por definir")
                    .homeTeamId(match.getHomeTeam() != null ? match.getHomeTeam().getId() : null)
                    .awayTeamId(match.getAwayTeam() != null ? match.getAwayTeam().getId() : null)
                    .homeTeamLogo(match.getHomeTeam() != null ? match.getHomeTeam().getLogoUrl() : null)
                    .awayTeamLogo(match.getAwayTeam() != null ? match.getAwayTeam().getLogoUrl() : null)
                    .matchDate(match.getMatchDate())
                    .round(match.getRound())
                    .groupName(match.getGroupName())
                    .finished(match.getFinished())
                    .actualHomeScore(match.getHomeScore())
                    .actualAwayScore(match.getAwayScore())
                    .displayClock(match.getDisplayClock())
                    .predHomeScore(mp != null ? mp.getHomeScore() : null)
                    .predAwayScore(mp != null ? mp.getAwayScore() : null)
                    .predSign(mp != null ? mp.getPredictionSign() : null)
                    .locked(isLocked)
                    .lockReason(lockReason)
                    .pointsAwarded(pointsAwarded)
                    .isExactScore(isExact)
                    .isCorrectSign(isCorrectSign)
                    .scoringDetails(scoringDetails)
                    .build());
        }

        return result;
    }

    /**
     * Guarda o actualiza los pronósticos de una lista de partidos comprobando los plazos individuales.
     */
    @Transactional
    @CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "allPredictionsDto", "myBetsDto", "allPredictionsDto", "myPredictionsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
    public int saveMatchdayPredictions(String email, Long groupId, List<MatchPredictionItemDTO> items) {
        if (email == null || email.isBlank()) {
            throw new SecurityException("Usuario no autenticado");
        }
        if (groupId == null) {
            throw new IllegalArgumentException("El identificador de grupo es obligatorio");
        }
        if (items == null || items.isEmpty()) {
            return 0;
        }

        UserAccount user = userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado: " + email));

        Edition edition = editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE")
                .orElseThrow(() -> new IllegalArgumentException("No se encontró una edición activa para la liga " + groupId));

        if (edition.isLocked()) {
            throw new IllegalStateException("El plazo general de la porra ha finalizado.");
        }

        // Asegurar membresía previa en ligas privadas
        Membership.MembershipId memId = new Membership.MembershipId(user.getId(), groupId);
        boolean isGlobal = edition.getLeague() != null && "GLOBAL".equalsIgnoreCase(edition.getLeague().getJoinCode());
        boolean isSuper = userAccountRepository.findByGoogleEmail(email).map(UserAccount::isSuperadmin).orElse(false);
        if (!membershipRepository.existsById(memId) && !isGlobal && !isSuper) {
            throw new SecurityException("No perteneces a esta liga privada. Debes unirte primero con un código de invitación válido.");
        }

        // Obtener o crear la predicción principal del usuario en esta liga
        Prediction prediction = predictionRepository.findByUserGoogleEmailAndEditionLeagueId(email, groupId)
                .orElseGet(() -> {
                    String predName = "Pronósticos de " + user.getParticipantName();
                    return predictionRepository.save(Prediction.builder()
                            .user(user)
                            .edition(edition)
                            .name(predName)
                            .isOfficial(false)
                            .paymentStatus("PENDING")
                            .createdAt(LocalDateTime.now())
                            .build());
                });

        

        ScoringRuleSet rules = ScoringRuleSet.fromJson(edition.getScoringRulesJson());
        LocalDateTime now = LocalDateTime.now();
        int savedCount = 0;

        for (MatchPredictionItemDTO item : items) {
            if (item.getMatchId() == null) continue;

            Match match = matchRepository.findById(item.getMatchId())
                    .orElseThrow(() -> new IllegalArgumentException("Partido no encontrado con ID: " + item.getMatchId()));

            // Comprobación estricta de fecha límite por partido individual
            if (Boolean.TRUE.equals(match.getFinished())) {
                throw new IllegalStateException(String.format("El partido %s vs %s ya ha finalizado y no puede modificarse.",
                        match.getHomeTeam() != null ? match.getHomeTeam().getName() : "Local",
                        match.getAwayTeam() != null ? match.getAwayTeam().getName() : "Visitante"));
            }
            if (match.getMatchDate() != null && match.getMatchDate().isBefore(now)) {
                throw new IllegalStateException(String.format("El partido %s vs %s ya ha comenzado (hora de inicio: %s) y su pronóstico está bloqueado.",
                        match.getHomeTeam() != null ? match.getHomeTeam().getName() : "Local",
                        match.getAwayTeam() != null ? match.getAwayTeam().getName() : "Visitante",
                        match.getMatchDate()));
            }

            // Calcular signo automáticamente si no se especifica explícitamente pero hay goles
            String sign = item.getSign();
            if ((sign == null || sign.isBlank()) && item.getHomeScore() != null && item.getAwayScore() != null) {
                int cmp = Integer.compare(item.getHomeScore(), item.getAwayScore());
                sign = cmp > 0 ? "1" : (cmp == 0 ? "X" : "2");
            }

            MatchPrediction matchPred = matchPredictionRepository.findByPredictionIdAndMatchId(prediction.getId(), match.getId())
                    .orElseGet(() -> MatchPrediction.builder()
                            .prediction(prediction)
                            .match(match)
                            .build());

            matchPred.setHomeScore(item.getHomeScore());
            matchPred.setAwayScore(item.getAwayScore());
            matchPred.setPredictionSign(sign);

            // Si el partido ya tuviese marcador (por ejemplo en simulaciones/tests)
            if (match.getHomeScore() != null && match.getAwayScore() != null
                    && item.getHomeScore() != null && item.getAwayScore() != null) {
                MatchScoreResult scoreResult = matchScoringCalculator.calculate(
                        item.getHomeScore(), item.getAwayScore(),
                        match.getHomeScore(), match.getAwayScore(),
                        rules
                );
                matchPred.setPointsAwarded(scoreResult.totalPoints());
                matchPred.setIsExactScore(scoreResult.exactScore());
                matchPred.setIsCorrectSign(scoreResult.correctSign());
                matchPred.setScoringDetails(scoreResult.explanation());
            }

            matchPredictionRepository.save(matchPred);
            savedCount++;
        }

        return savedCount;
    }

    /**
     * Evalúa y actualiza los puntos de todos los pronósticos de un partido que acaba de finalizar.
     */
    @Transactional
    public void evaluatePredictionsForMatch(Match match) {
        if (match == null || match.getId() == null || match.getHomeScore() == null || match.getAwayScore() == null) {
            return;
        }

        List<MatchPrediction> predictions = matchPredictionRepository.findByMatchId(match.getId());
        for (MatchPrediction mp : predictions) {
            ScoringRuleSet rules = null;
            if (mp.getPrediction() != null && mp.getPrediction().getEdition() != null) {
                rules = ScoringRuleSet.fromJson(mp.getPrediction().getEdition().getScoringRulesJson());
            }
            if (rules == null) {
                rules = ScoringRuleSet.defaultWorldCup2026();
            }

            MatchScoreResult result = matchScoringCalculator.calculate(
                    mp.getHomeScore(), mp.getAwayScore(),
                    match.getHomeScore(), match.getAwayScore(),
                    rules
            );

            mp.setPointsAwarded(result.totalPoints());
            mp.setIsExactScore(result.exactScore());
            mp.setIsCorrectSign(result.correctSign());
            mp.setScoringDetails(result.explanation());
            matchPredictionRepository.save(mp);
        }
    }

    /**
     * Devuelve las predicciones de todos los miembros del grupo para un partido específico.
     * Si el partido está abierto, los resultados de otros usuarios permanecen ocultos para evitar copias.
     */
    @Transactional(readOnly = true)
    public List<MatchdayFriendBetDTO> getFriendBetsForMatch(String email, Long groupId, Long matchId) {
        if (groupId == null || matchId == null) {
            throw new IllegalArgumentException("El grupo y el partido son obligatorios");
        }

        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new IllegalArgumentException("Partido no encontrado: " + matchId));

        Edition edition = editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE").orElse(null);

        UserAccount caller = (email != null && !email.isBlank())
                ? userAccountRepository.findByGoogleEmail(email)
                    .or(() -> userAccountRepository.findByParticipantNameIgnoreCase(email))
                    .orElse(null)
                : null;

        if (!Long.valueOf(1L).equals(groupId)) {
            boolean isMember = false;
            if (caller != null) {
                if (caller.isSuperadmin()) {
                    isMember = true;
                } else {
                    Membership.MembershipId memId = new Membership.MembershipId(caller.getId(), groupId);
                    isMember = membershipRepository.existsById(memId);
                }
            }
            if (!isMember) {
                throw new SecurityException("No perteneces a esta liga privada.");
            }
        }

        LocalDateTime now = LocalDateTime.now();
        boolean isMatchLocked = Boolean.TRUE.equals(match.getFinished())
                || (match.getMatchDate() != null && match.getMatchDate().isBefore(now))
                || (edition != null && edition.isLocked());

        // Obtener miembros del grupo
        List<Membership> memberships = membershipRepository.findByLeagueId(groupId);
        Map<Long, UserAccount> memberMap = new LinkedHashMap<>();
        for (Membership m : memberships) {
            if (m.getUser() != null) {
                memberMap.put(m.getUser().getId(), m.getUser());
            }
        }

        // Obtener todas las predicciones del partido en esta liga
        List<MatchPrediction> matchPreds = matchPredictionRepository.findByMatchId(matchId).stream()
                .filter(mp -> mp.getPrediction() != null && mp.getPrediction().getEdition() != null
                        && mp.getPrediction().getEdition().getLeague() != null
                        && groupId.equals(mp.getPrediction().getEdition().getLeague().getId()))
                .collect(Collectors.toList());

        Map<Long, MatchPrediction> userPredMap = new HashMap<>();
        for (MatchPrediction mp : matchPreds) {
            if (mp.getPrediction().getUser() != null) {
                userPredMap.put(mp.getPrediction().getUser().getId(), mp);
                memberMap.putIfAbsent(mp.getPrediction().getUser().getId(), mp.getPrediction().getUser());
            }
        }

        List<MatchdayFriendBetDTO> list = new ArrayList<>();
        for (UserAccount member : memberMap.values()) {
            boolean isCaller = caller != null && caller.getId().equals(member.getId());
            MatchPrediction mp = userPredMap.get(member.getId());

            MatchdayFriendBetDTO.MatchdayFriendBetDTOBuilder builder = MatchdayFriendBetDTO.builder()
                    .userId(member.getId())
                    .participantName(member.getParticipantName() != null ? member.getParticipantName() : "Anónimo")
                    // avatarUrl opcional
                    .isCaller(isCaller);

            if (mp != null) {
                builder.hasPredicted(true);
                builder.updatedAt(mp.getUpdatedAt() != null ? mp.getUpdatedAt() : mp.getCreatedAt());

                if (isMatchLocked || isCaller) {
                    builder.homeScore(mp.getHomeScore())
                            .awayScore(mp.getAwayScore())
                            .sign(mp.getPredictionSign())
                            .pointsAwarded(mp.getPointsAwarded())
                            .isExactScore(mp.getIsExactScore())
                            .isCorrectSign(mp.getIsCorrectSign())
                            .scoringDetails(mp.getScoringDetails());
                } else {
                    builder.scoringDetails("🔒 Pronóstico oculto hasta el pitido inicial");
                }
            } else {
                builder.hasPredicted(false)
                        .scoringDetails(isMatchLocked ? "❌ Sin pronóstico (0 pts)" : "⏳ Pendiente de pronosticar");
            }

            list.add(builder.build());
        }

        list.sort((a, b) -> {
            if (a.isCaller() != b.isCaller()) return a.isCaller() ? -1 : 1;
            int ptsA = a.getPointsAwarded() != null ? a.getPointsAwarded() : -1;
            int ptsB = b.getPointsAwarded() != null ? b.getPointsAwarded() : -1;
            if (ptsA != ptsB) return Integer.compare(ptsB, ptsA);
            return a.getParticipantName().compareToIgnoreCase(b.getParticipantName());
        });

        return list;
    }
}
