package com.porra.mundial.service.tournament;

import com.porra.mundial.service.prediction.ScoreInvalidationService;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.KnockoutRound;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

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
}
