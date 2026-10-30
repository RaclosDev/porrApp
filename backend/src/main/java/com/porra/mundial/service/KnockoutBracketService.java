package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.PredictionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Cuadro de eliminatorias oficial: coloca a los ganadores de semifinales en la final y a los
 * perdedores en el tercer puesto, y completa el cuadro oficial con los partidos reales.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KnockoutBracketService {

    private final MatchRepository matchRepository;
    private final CompetitionRepository competitionRepository;
    private final PredictionRepository predictionRepository;
    private final PredictionService predictionService;
    private final ScoreInvalidationService scoreInvalidationService;

    /** Partidos de las últimas rondas, ya clasificados. */
    record FinalRounds(List<Match> semis, Match finalMatch, Match thirdPlaceMatch) {
    }

    /**
     * Coloca a los ganadores (final) y perdedores (tercer puesto) de las semifinales ya decididas.
     *
     * @return número de partidos actualizados
     */
    public int propagateKnockoutWinners() {
        try {
            FinalRounds rounds = findFinalRounds();
            List<Match> decidedSemis = rounds.semis().stream()
                    .filter(m -> Boolean.TRUE.equals(m.getFinished()) || winnerOf(m) != null)
                    .toList();
            int updated = 0;
            for (int i = 0; i < decidedSemis.size(); i++) {
                Match semi = decidedSemis.get(i);
                String slot = i == 0 ? "home" : "away";
                if (placeTeam(rounds.finalMatch(), winnerOf(semi), slot)) updated++;
                if (placeTeam(rounds.thirdPlaceMatch(), loserOf(semi), slot)) updated++;
            }
            if (updated > 0) {
                scoreInvalidationService.invalidateWorldCup();
            }
            return updated;
        } catch (Exception e) {
            log.warn("No se pudieron propagar los ganadores de eliminatorias: {}", e.getMessage());
            return 0;
        }
    }

    /**
     * Rellena final, campeón, partido por el tercer puesto y su ganador a partir de los partidos
     * reales. Los huecos que todavía no se conocen conservan el valor que ya tuviera el DTO.
     */
    public void enrichPredictionDataWithMatches(PredictionDataDTO dto) {
        if (dto == null) return;
        try {
            FinalRounds rounds = findFinalRounds();
            List<Match> semis = rounds.semis();
            Match semi0 = semis.isEmpty() ? null : semis.get(0);
            Match semi1 = semis.size() > 1 ? semis.get(1) : null;

            Match fm = rounds.finalMatch();
            if (fm != null || semis.size() >= 2) {
                String home = fm != null ? realName(fm.getHomeTeam()) : null;
                String away = fm != null ? realName(fm.getAwayTeam()) : null;
                if (home == null) home = nameOf(winnerOf(semi0));
                if (away == null) away = nameOf(winnerOf(semi1));
                dto.setFinalMatch(mergePair(dto.getFinalMatch(), home, away));
                if (fm != null && !Team.isPlaceholder(fm.getWinnerTeam())) {
                    dto.setChampion(fm.getWinnerTeam().getName());
                }
            }

            Match tm = rounds.thirdPlaceMatch();
            if (tm != null || semis.size() >= 2) {
                String home = tm != null ? realName(tm.getHomeTeam()) : null;
                String away = tm != null ? realName(tm.getAwayTeam()) : null;
                if (home == null) home = realName(loserOf(semi0));
                if (away == null) away = realName(loserOf(semi1));
                dto.setThirdPlaceMatch(mergePair(dto.getThirdPlaceMatch(), home, away));
                Team thirdWinner = tm != null ? winnerOf(tm) : null;
                if (!Team.isPlaceholder(thirdWinner)) {
                    dto.setThirdPlaceWinner(thirdWinner.getName());
                }
            }
        } catch (Exception e) {
            log.warn("No se pudo completar el cuadro oficial con los partidos: {}", e.getMessage());
        }
    }

    /**
     * Cuadro oficial: el pronóstico marcado como oficial (si existe) completado con los
     * resultados reales de las rondas finales.
     */
    public PredictionDataDTO officialBracket() {
        PredictionDataDTO bracket = predictionRepository.findByIsOfficialTrue()
                .map(official -> predictionService.getPredictionData(official.getId()))
                .orElseGet(PredictionDataDTO::new);
        enrichPredictionDataWithMatches(bracket);
        return bracket;
    }

    /** Partidos del Mundial, el único torneo con cuadro oficial; los de otras competiciones no cuentan. */
    public List<Match> worldCupMatches() {
        return competitionRepository.findIdByExternalId(Competition.WORLD_CUP_EXTERNAL_ID)
                .map(matchRepository::findByCompetitionId)
                .orElse(List.of());
    }

    private FinalRounds findFinalRounds() {
        List<Match> knockout = worldCupMatches().stream().filter(KnockoutBracketService::isKnockoutMatch).toList();
        List<Match> semis = knockout.stream()
                .filter(m -> isRound(m.getRound(), "sf", "semi"))
                .sorted(Comparator.comparing(Match::getMatchDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        Match finalMatch = knockout.stream()
                .filter(m -> isRound(m.getRound(), "final") && !isRound(m.getRound(), "semi", "quarter", "octav", "third", "tercer", "3rd", "3er"))
                .findFirst().orElse(null);
        Match thirdPlace = knockout.stream()
                .filter(m -> isRound(m.getRound(), "third", "tercer", "3rd", "3er"))
                .findFirst().orElse(null);
        return new FinalRounds(semis, finalMatch, thirdPlace);
    }

    /** Coloca un equipo en el hueco indicado si está libre; si no, en el otro hueco libre. */
    private boolean placeTeam(Match match, Team team, String preferredSlot) {
        if (match == null || Team.isPlaceholder(team)) return false;
        boolean alreadyPlaced = (match.getHomeTeam() != null && Objects.equals(match.getHomeTeam().getId(), team.getId()))
                || (match.getAwayTeam() != null && Objects.equals(match.getAwayTeam().getId(), team.getId()));
        if (alreadyPlaced) return false;

        boolean homeFree = Team.isPlaceholder(match.getHomeTeam());
        boolean awayFree = Team.isPlaceholder(match.getAwayTeam());
        if ("home".equals(preferredSlot) && homeFree) {
            match.setHomeTeam(team);
        } else if ("away".equals(preferredSlot) && awayFree) {
            match.setAwayTeam(team);
        } else if (homeFree) {
            match.setHomeTeam(team);
        } else if (awayFree) {
            match.setAwayTeam(team);
        } else {
            return false;
        }
        matchRepository.save(match);
        return true;
    }

    /** Ganador declarado o, si no lo hay, el que va por delante en el marcador. */
    static Team winnerOf(Match m) {
        if (m == null) return null;
        if (m.getWinnerTeam() != null) return m.getWinnerTeam();
        if (hasDecisiveScore(m)) {
            return m.getHomeScore() > m.getAwayScore() ? m.getHomeTeam() : m.getAwayTeam();
        }
        return null;
    }

    static Team loserOf(Match m) {
        if (m == null || m.getHomeTeam() == null || m.getAwayTeam() == null) return null;
        if (m.getWinnerTeam() != null) {
            return Objects.equals(m.getWinnerTeam().getId(), m.getHomeTeam().getId()) ? m.getAwayTeam() : m.getHomeTeam();
        }
        if (hasDecisiveScore(m)) {
            return m.getHomeScore() > m.getAwayScore() ? m.getAwayTeam() : m.getHomeTeam();
        }
        return null;
    }

    static boolean isKnockoutMatch(Match m) {
        if (m == null) return false;
        if (m.getGroupName() != null && !"-".equals(m.getGroupName()) && !m.getGroupName().isBlank()) return false;
        return !isRound(m.getRound(), "group", "jornada");
    }

    private static boolean hasDecisiveScore(Match m) {
        return m.getHomeScore() != null && m.getAwayScore() != null && !Objects.equals(m.getHomeScore(), m.getAwayScore());
    }

    private static boolean isRound(String round, String... keys) {
        if (round == null) return false;
        String lower = round.toLowerCase();
        return Arrays.stream(keys).anyMatch(lower::contains);
    }

    private static String nameOf(Team team) {
        return team != null ? team.getName() : null;
    }

    private static String realName(Team team) {
        return Team.isPlaceholder(team) ? null : team.getName();
    }

    private static List<String> mergePair(List<String> current, String home, String away) {
        if (home == null && away == null) return current;
        String currentHome = current != null && !current.isEmpty() ? current.get(0) : null;
        String currentAway = current != null && current.size() > 1 ? current.get(1) : null;
        return Arrays.asList(home != null ? home : currentHome, away != null ? away : currentAway);
    }
}
