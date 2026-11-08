package com.porra.mundial.service.prediction;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.PredictionLockMode;
import com.porra.mundial.model.Sport;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.util.AppTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Playoffs de la NBA: series al mejor de 7, play-in, cierre por serie, validación y puntos. */
class NbaPlayoffsTest {
    private static final Instant CREATED = AppTime.fromLocal(LocalDateTime.of(2027, 3, 1, 12, 0));
    private static final Instant PLAY_IN = AppTime.fromLocal(LocalDateTime.of(2027, 4, 14, 1, 30));
    private static final Instant FIRST_ROUND = AppTime.fromLocal(LocalDateTime.of(2027, 4, 18, 19, 0));

    private final MatchRepository matches = mock(MatchRepository.class);
    private final Competition nba = Competition.builder().id(9L).name("NBA")
            .externalId(Competition.NBA_EXTERNAL_ID).formatType("TOURNAMENT").build();
    private final List<Match> fixtures = new ArrayList<>();
    private final Map<String, Team> teams = new HashMap<>();
    private long nextId = 1;

    @BeforeEach
    void setup() {
        when(matches.findByCompetitionId(9L)).thenReturn(fixtures);
    }

    private Team team(String name) {
        return teams.computeIfAbsent(name, key -> Team.builder().id((long) teams.size() + 100).name(key).build());
    }

    private Edition edition(PredictionLockMode mode) {
        return Edition.builder().id(1L).competition(nba).poolFormat(PoolFormat.KNOCKOUTS_ONLY)
                .lockMode(mode).createdAt(CREATED).build();
    }

    private Match game(String round, String home, String away, Instant date, Integer homeScore, Integer awayScore,
                       String seriesWinner) {
        boolean played = homeScore != null;
        Match match = Match.builder().id(nextId++).competition(nba).round(round)
                .homeTeam(team(home)).awayTeam(team(away)).matchDate(date)
                .homeScore(homeScore).awayScore(awayScore).finished(played)
                .status(played ? MatchStatusNormalized.FINISHED : MatchStatusNormalized.SCHEDULED)
                .winnerTeam(seriesWinner == null ? null : team(seriesWinner)).build();
        fixtures.add(match);
        return match;
    }

    /**
     * Serie de {@code home} contra {@code away}: {@code results} son los ganadores de cada partido jugado;
     * hasta 7 partidos programados un día tras otro. El que da la cuarta victoria marca quién gana la serie.
     */
    private void series(String round, String home, String away, Instant first, String... results) {
        Map<String, Integer> wins = new HashMap<>();
        for (int game = 0; game < 7; game++) {
            Instant date = first.plus(2L * game, ChronoUnit.DAYS);
            if (game < results.length) {
                String winner = results[game];
                int count = wins.merge(winner, 1, Integer::sum);
                boolean homeWins = winner.equals(home);
                game(round, home, away, date, homeWins ? 110 : 100, homeWins ? 100 : 110, count == 4 ? winner : null);
            } else if (wins.values().stream().noneMatch(count -> count == 4)) {
                game(round, home, away, date, null, null, null);
            }
        }
    }

    private CustomLockService lockService(Instant now) {
        CustomLockService service = new CustomLockService(matches, mock(TeamRepository.class), mock(EditionRepository.class));
        service.setClock(Clock.fixed(now, CustomLockService.ZONE));
        return service;
    }

    private static PredictionDataDTO picks(List<List<String>> rounds, List<List<Integer>> games, String champion) {
        PredictionDataDTO data = new PredictionDataDTO();
        data.setCustomRounds(rounds);
        data.setCustomSeriesGames(games);
        data.setChampion(champion);
        return data;
    }

    @SafeVarargs
    private static <T> List<T> row(T... values) {
        return Arrays.asList(values);
    }

    @Test
    @DisplayName("La NBA es baloncesto, se sortea ronda a ronda y se juega por series")
    void nbaPlaysSeries() {
        assertEquals(Sport.BASKETBALL, Sport.ofExternalId("nba"));
        assertTrue(nba.drawsKnockoutRounds());
        assertTrue(nba.playsSeries());
        assertFalse(Competition.builder().externalId("uefa.champions").formatType("LEAGUE").build().playsSeries());
    }

    @Test
    @DisplayName("Play-in a partido único y series al mejor de 7; cada ronda se abre con las series que ya tienen rivales")
    void roundsAndSeries() {
        game("playin", "Magic", "Hawks", PLAY_IN, null, null, null);
        series("r16", "Cavaliers", "Heat", FIRST_ROUND);
        series("r16", "Celtics", "Magic", FIRST_ROUND.plus(1, ChronoUnit.HOURS));

        List<DrawnKnockout.Round> rounds = DrawnKnockout.rounds(edition(PredictionLockMode.PER_MATCH), fixtures);

        assertEquals(List.of("playin", "r16", "qf", "sf", "final"), rounds.stream().map(DrawnKnockout.Round::key).toList());
        assertEquals(1, rounds.get(0).bestOf());
        assertEquals(7, rounds.get(1).bestOf());
        assertEquals(2, rounds.get(1).ties().size());
        assertEquals(7, rounds.get(1).ties().get(0).legs().size());
        // Con 2 de 8 series ya se puede pronosticar: cada serie se abre por su cuenta.
        assertTrue(rounds.get(1).drawn());
        assertFalse(rounds.get(2).drawn());
    }

    @Test
    @DisplayName("Gana la serie quien llega a 4 victorias, aunque quede un partido «si hace falta» sin jugar")
    void seriesWinnerAndGames() {
        series("r16", "Thunder", "Grizzlies", FIRST_ROUND, "Thunder", "Thunder", "Grizzlies", "Thunder", "Thunder");
        // ESPN aún lista el sexto partido, que ya no se jugará.
        game("r16", "Grizzlies", "Thunder", FIRST_ROUND.plus(10, ChronoUnit.DAYS), null, null, null);
        series("r16", "Celtics", "Magic", FIRST_ROUND, "Celtics", "Magic");

        List<DrawnKnockout.Tie> ties = DrawnKnockout.rounds(edition(PredictionLockMode.PER_MATCH), fixtures).get(0).ties();

        assertEquals("Thunder", ties.get(0).winner().getName());
        assertEquals(5, ties.get(0).gamesPlayed());
        assertNull(ties.get(1).winner());
        assertEquals(2, ties.get(1).gamesPlayed());
    }

    @Test
    @DisplayName("Cada serie se cierra al empezar su primer partido; las que aún no han empezado siguen abiertas")
    void perSeriesLock() {
        series("r16", "Cavaliers", "Heat", FIRST_ROUND);
        series("r16", "Celtics", "Magic", FIRST_ROUND.plus(1, ChronoUnit.DAYS));
        CustomLockService service = lockService(FIRST_ROUND.plus(1, ChronoUnit.HOURS));

        CustomLockService.LockState state = service.state(edition(PredictionLockMode.PER_MATCH));

        assertTrue(state.pickLocked(0, 0));
        assertFalse(state.pickLocked(0, 1));
        assertFalse(state.fullyLocked());
    }

    @Test
    @DisplayName("Se elige quién gana cada serie y en cuántos partidos (4 a 7); en el play-in solo quién gana")
    void validatesSeriesGames() {
        game("playin", "Magic", "Hawks", PLAY_IN, null, null, null);
        series("r16", "Cavaliers", "Heat", FIRST_ROUND);
        CustomBracketPredictionValidator validator = new CustomBracketPredictionValidator(mock(TeamRepository.class), matches);
        Edition edition = edition(PredictionLockMode.PER_MATCH);

        assertDoesNotThrow(() -> validator.validate(edition,
                picks(List.of(row("Magic"), row("Cavaliers")), List.of(row((Integer) null), row(5)), null)));
        assertDoesNotThrow(() -> validator.validate(edition,
                picks(List.of(row((String) null), row("Heat")), null, null)));
        assertThrows(BusinessException.class, () -> validator.validate(edition,
                picks(List.of(row((String) null), row("Heat")), List.of(row((Integer) null), row(3)), null)));
        assertThrows(BusinessException.class, () -> validator.validate(edition,
                picks(List.of(row((String) null), row("Heat")), List.of(row((Integer) null), row(8)), null)));
        assertThrows(BusinessException.class, () -> validator.validate(edition,
                picks(List.of(row("Magic"), row((String) null)), List.of(row(4), row((Integer) null)), null)));
        assertThrows(BusinessException.class, () -> validator.validate(edition,
                picks(List.of(row((String) null), row((String) null)), List.of(row((Integer) null), row(6)), null)));
    }

    @Test
    @DisplayName("Una serie ya empezada no se puede cambiar, tampoco en cuántos partidos")
    void lockedSeriesGamesCannotChange() {
        series("r16", "Cavaliers", "Heat", FIRST_ROUND);
        CustomLockService service = lockService(FIRST_ROUND.plus(1, ChronoUnit.HOURS));
        CustomLockService.LockState state = service.state(edition(PredictionLockMode.PER_MATCH));
        PredictionDataDTO saved = picks(List.of(row("Cavaliers")), List.of(row(5)), null);

        assertThrows(BusinessException.class, () -> service.requireLockedPartsUnchanged(state, saved,
                picks(List.of(row("Cavaliers")), List.of(row(6)), null)));
        assertDoesNotThrow(() -> service.requireLockedPartsUnchanged(state, saved,
                picks(List.of(row("Cavaliers")), List.of(row(5)), null)));
        // A los demás solo se les enseña lo ya cerrado.
        assertEquals(5, service.lockedPartsOnly(state, saved).getCustomSeriesGames().get(0).get(0));
    }

    @Test
    @DisplayName("Puntos por serie acertada según la ronda y extra por acertar en cuántos partidos")
    void scoresSeries() {
        game("playin", "Magic", "Hawks", PLAY_IN, 120, 95, "Magic");
        series("r16", "Thunder", "Grizzlies", FIRST_ROUND, "Thunder", "Thunder", "Thunder", "Thunder");
        series("r16", "Nuggets", "Clippers", FIRST_ROUND, "Nuggets", "Clippers", "Clippers", "Nuggets",
                "Nuggets", "Clippers", "Nuggets");
        series("r16", "Celtics", "Magic", FIRST_ROUND, "Celtics", "Magic", "Celtics", "Celtics", "Celtics");
        Edition edition = edition(PredictionLockMode.PER_MATCH);
        Prediction prediction = Prediction.builder().edition(edition).bracketData(picks(
                List.of(row("Magic"), row("Thunder", "Nuggets", "Magic")),
                List.of(row((Integer) null), row(4, 6, 7)), null)).build();

        var score = new CustomBracketScoringService(matches, mock(TeamRepository.class)).score(prediction);

        // Play-in 5 + Thunder 10 + 5 (4-0 exacto) + Nuggets 10 (dijo 6, fueron 7); Magic pierde.
        assertEquals(30, score.getTotal());
        assertEquals(4, score.getLog().size());
        assertTrue(score.getLog().stream().anyMatch(entry -> entry.getMsg().contains("serie exacta, Thunder gana 4-0")));
    }

    @Test
    @DisplayName("Las Finales dan el campeón")
    void finalsCrownTheChampion() {
        Instant finals = AppTime.fromLocal(LocalDateTime.of(2027, 6, 4, 2, 30));
        series("final", "Knicks", "Spurs", finals, "Knicks", "Knicks", "Spurs", "Knicks", "Knicks");
        CustomBracketPredictionValidator validator = new CustomBracketPredictionValidator(mock(TeamRepository.class), matches);
        PredictionDataDTO data = picks(List.of(row("Knicks")), List.of(row(5)), "Knicks");

        assertDoesNotThrow(() -> validator.validate(Edition.builder().id(2L).competition(nba)
                .poolFormat(PoolFormat.KNOCKOUTS_ONLY).lockMode(PredictionLockMode.PER_MATCH)
                .createdAt(finals.minus(5, ChronoUnit.DAYS)).build(), data));
        var score = new CustomBracketScoringService(matches, mock(TeamRepository.class))
                .score(Prediction.builder().edition(Edition.builder().id(2L).competition(nba)
                        .poolFormat(PoolFormat.KNOCKOUTS_ONLY).createdAt(finals.minus(5, ChronoUnit.DAYS)).build())
                        .bracketData(data).build());

        assertEquals(75, score.getTotal());
        assertTrue(score.getLog().get(0).getMsg().startsWith("Campeón acertado"));
    }
}
