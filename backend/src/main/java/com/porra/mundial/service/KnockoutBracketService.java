package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.KnockoutRound;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Cuadro de eliminatorias oficial: coloca a los ganadores de semifinales en la final y a los
 * perdedores en el tercer puesto, y rellena final, campeón y tercer puesto con los partidos reales.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KnockoutBracketService {

    private final MatchRepository matchRepository;
    private final CompetitionRepository competitionRepository;
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
        return propagate(this::worldCupMatches);
    }

    /**
     * Igual que {@link #propagateKnockoutWinners()}, con los partidos del Mundial ya cargados
     * ({@link #worldCupMatches()}), para no volver a leerlos si ya los tiene quien llama.
     *
     * @return número de partidos actualizados
     */
    public int propagateKnockoutWinners(List<Match> worldCupMatches) {
        return propagate(() -> worldCupMatches);
    }

    private int propagate(Supplier<List<Match>> worldCupMatches) {
        try {
            FinalRounds rounds = findFinalRounds(worldCupMatches.get());
            List<Match> semis = rounds.semis();
            List<Team> participants = semis.stream()
                    .flatMap(m -> java.util.stream.Stream.of(m.getHomeTeam(), m.getAwayTeam()))
                    .filter(Objects::nonNull).toList();
            int updated = 0;
            for (int slot = 0; slot < 2; slot++) {
                Match semi = slot < semis.size() ? semis.get(slot) : null;
                if (placeDerivedTeam(rounds.finalMatch(), winnerOf(semi), slot == 0, participants)) updated++;
                if (placeDerivedTeam(rounds.thirdPlaceMatch(), loserOf(semi), slot == 0, participants)) updated++;
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
            FinalRounds rounds = findFinalRounds(worldCupMatches());
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
                if (!Team.isPlaceholder(winnerOf(fm))) {
                    dto.setChampion(winnerOf(fm).getName());
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

    /** Partidos del Mundial, el único torneo con cuadro oficial; los de otras competiciones no cuentan. */
    public List<Match> worldCupMatches() {
        return competitionRepository.findIdByExternalId(Competition.WORLD_CUP_EXTERNAL_ID)
                .map(matchRepository::findByCompetitionId)
                .orElse(List.of());
    }

    private FinalRounds findFinalRounds(List<Match> worldCupMatches) {
        List<Match> knockout = worldCupMatches.stream().filter(KnockoutBracketService::isKnockoutMatch).toList();
        List<Match> semis = knockout.stream()
                .filter(m -> KnockoutRound.fromLabel(m.getRound()) == KnockoutRound.SEMI_FINAL)
                .sorted(Comparator.comparing(Match::getMatchDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        Match finalMatch = knockout.stream()
                .filter(m -> KnockoutRound.fromLabel(m.getRound()) == KnockoutRound.FINAL)
                .findFirst().orElse(null);
        Match thirdPlace = knockout.stream()
                .filter(m -> KnockoutRound.fromLabel(m.getRound()) == KnockoutRound.THIRD_PLACE)
                .findFirst().orElse(null);
        return new FinalRounds(semis, finalMatch, thirdPlace);
    }

    /** Solo los partidos sintéticos sin empezar admiten equipos derivados; el proveedor es autoridad. */
    private boolean placeDerivedTeam(Match match, Team team, boolean home, List<Team> participants) {
        if (match == null || (match.getExternalId() != null && !match.getExternalId().isBlank())
                || Boolean.TRUE.equals(match.getFinished()) || match.getHomeScore() != null || match.getAwayScore() != null
                || match.getStatus() != com.porra.mundial.model.MatchStatusNormalized.SCHEDULED) return false;
        Team current = home ? match.getHomeTeam() : match.getAwayTeam();
        boolean derived = Team.isPlaceholder(current) || participants.stream()
                .anyMatch(t -> Objects.equals(t.getId(), current.getId()));
        if (!derived || (Team.isPlaceholder(current) && Team.isPlaceholder(team))
                || (current != null && team != null && Objects.equals(current.getId(), team.getId()))) return false;
        if (home) match.setHomeTeam(team);
        else match.setAwayTeam(team);
        matchRepository.save(match);
        return true;
    }

    /** Ganador de un partido terminado, por declaración oficial o marcador definitivo. */
    static Team winnerOf(Match m) {
        if (m == null || !Boolean.TRUE.equals(m.getFinished())) return null;
        if (m.getWinnerTeam() != null) return m.getWinnerTeam();
        if (hasDecisiveScore(m)) {
            return m.getHomeScore() > m.getAwayScore() ? m.getHomeTeam() : m.getAwayTeam();
        }
        return null;
    }

    static Team loserOf(Match m) {
        if (m == null || !Boolean.TRUE.equals(m.getFinished()) || m.getHomeTeam() == null || m.getAwayTeam() == null) return null;
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
        return KnockoutRound.fromLabel(m.getRound()) != null;
    }

    private static boolean hasDecisiveScore(Match m) {
        return m.getHomeScore() != null && m.getAwayScore() != null && !Objects.equals(m.getHomeScore(), m.getAwayScore());
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
