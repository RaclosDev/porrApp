package app.porrapp.service.prediction;

import app.porrapp.dto.PredictionDataDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.Match;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.Prediction;
import app.porrapp.model.PredictionLockMode;
import app.porrapp.model.Team;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.TeamRepository;
import app.porrapp.util.AppTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Eliminatorias sorteadas ronda a ronda (Champions, Copa del Rey): cruces, cierre, validación y puntos. */
class DrawnKnockoutTest {
    private static final Instant CREATED = AppTime.fromLocal(LocalDateTime.of(2026, 1, 31, 12, 0));
    private static final Instant PLAYOFF_FIRST = AppTime.fromLocal(LocalDateTime.of(2026, 2, 17, 21, 0));
    private static final Instant R16_FIRST = AppTime.fromLocal(LocalDateTime.of(2026, 3, 10, 21, 0));

    private final MatchRepository matches = mock(MatchRepository.class);
    private final Competition champions = Competition.builder().id(5L).name("UEFA Champions League")
            .externalId("uefa.champions").formatType("LEAGUE").build();
    private final List<Match> fixtures = new ArrayList<>();
    private final Map<String, Team> teams = new HashMap<>();
    private long nextId = 1;

    @BeforeEach
    void setup() {
        when(matches.findByCompetitionId(5L)).thenReturn(fixtures);
    }

    private Team team(String name) {
        return teams.computeIfAbsent(name, key -> Team.builder().id((long) teams.size() + 100).name(key).build());
    }

    private Edition edition(Instant created, PredictionLockMode mode) {
        return Edition.builder().id(1L).competition(champions).poolFormat(PoolFormat.KNOCKOUTS_ONLY)
                .lockMode(mode).createdAt(created).build();
    }

    private Match leg(String round, String home, String away, Instant date, String winner) {
        Match match = Match.builder().id(nextId++).competition(champions).round(round)
                .homeTeam(team(home)).awayTeam(team(away)).matchDate(date)
                .finished(winner != null).status(winner != null ? MatchStatusNormalized.FINISHED : MatchStatusNormalized.SCHEDULED)
                .winnerTeam(winner == null ? null : team(winner)).build();
        fixtures.add(match);
        return match;
    }

    /** Cruce a doble partido; {@code firstLegWinner} y {@code qualifier} son null si aún no se han jugado. */
    private void tie(String round, String home, String away, Instant first, String firstLegWinner, String qualifier) {
        leg(round, home, away, first, firstLegWinner);
        leg(round, away, home, first.plus(7, ChronoUnit.DAYS), qualifier);
    }

    /** Playoff completo (8 cruces): P1..P16; pasan los impares, aunque la ida la ganen los pares. */
    private void playoff(boolean played) {
        for (int i = 1; i <= 15; i += 2) {
            tie("playoff", "P" + i, "P" + (i + 1), PLAYOFF_FIRST, played ? "P" + (i + 1) : null, played ? "P" + i : null);
        }
    }

    private void roundOf16() {
        for (int i = 1; i <= 15; i += 2) {
            tie("r16", "S" + i, "P" + i, R16_FIRST, null, null);
        }
    }

    private List<DrawnKnockout.Round> rounds(Edition edition) {
        return DrawnKnockout.rounds(edition, fixtures);
    }

    @Test
    @DisplayName("La ida y la vuelta forman un cruce y pasa quien gana la vuelta, no la ida")
    void groupsLegsIntoTiesWonByTheDecidingLeg() {
        playoff(true);

        DrawnKnockout.Round playoff = rounds(edition(CREATED, PredictionLockMode.PER_ROUND)).get(0);

        assertEquals("playoff", playoff.key());
        assertEquals(8, playoff.ties().size());
        assertTrue(playoff.drawn());
        DrawnKnockout.Tie first = playoff.ties().get(0);
        assertEquals(2, first.legs().size());
        assertEquals("P1", first.home().getName());
        assertEquals("P1", first.winner().getName());
    }

    @Test
    @DisplayName("Tras el playoff de la UEFA vienen octavos (sin dieciseisavos) y las rondas sin sortear esperan sus cruces")
    void uefaSequenceSkipsRoundOf32() {
        playoff(false);

        List<DrawnKnockout.Round> rounds = rounds(edition(CREATED, PredictionLockMode.PER_ROUND));

        assertEquals(List.of("playoff", "r16", "qf", "sf", "final"), rounds.stream().map(DrawnKnockout.Round::key).toList());
        assertEquals(List.of(8, 8, 4, 2, 1), rounds.stream().map(DrawnKnockout.Round::expectedTies).toList());
        assertFalse(rounds.get(1).drawn());
    }

    @Test
    @DisplayName("Una ronda con cruces por importar aún no está sorteada")
    void partialRoundIsNotDrawn() {
        tie("r16", "A", "B", R16_FIRST, null, null);

        assertFalse(rounds(edition(CREATED, PredictionLockMode.PER_ROUND)).get(0).drawn());
    }

    @Test
    @DisplayName("Una liga creada tras empezar el playoff empieza en octavos")
    void leagueCreatedLateStartsAtTheFirstRoundLeft() {
        playoff(true);
        roundOf16();

        List<DrawnKnockout.Round> rounds = rounds(edition(PLAYOFF_FIRST.plus(10, ChronoUnit.DAYS), PredictionLockMode.PER_ROUND));

        assertEquals("r16", rounds.get(0).key());
        assertTrue(rounds.get(0).drawn());
    }

    @Test
    @DisplayName("Solo cuenta la última temporada y, si ya había terminado al crear la liga, no hay rondas")
    void onlyTheLastSeasonCounts() {
        Instant lastFinal = AppTime.fromLocal(LocalDateTime.of(2025, 5, 31, 21, 0));
        leg("final", "Old1", "Old2", lastFinal, "Old1");

        assertTrue(rounds(edition(AppTime.fromLocal(LocalDateTime.of(2025, 12, 1, 12, 0)), PredictionLockMode.PER_ROUND)).isEmpty());

        playoff(false);
        List<DrawnKnockout.Round> rounds = rounds(edition(CREATED, PredictionLockMode.PER_ROUND));
        assertEquals("playoff", rounds.get(0).key());
        assertTrue(rounds.get(rounds.size() - 1).ties().isEmpty(), "la final antigua no entra");
    }

    @Test
    @DisplayName("El orden de los cruces no cambia aunque se mueva una fecha")
    void tieOrderIsStable() {
        playoff(false);
        fixtures.get(0).setMatchDate(PLAYOFF_FIRST.plus(1, ChronoUnit.DAYS));
        fixtures.get(1).setMatchDate(PLAYOFF_FIRST.plus(8, ChronoUnit.DAYS));

        assertEquals("P1", rounds(edition(CREATED, PredictionLockMode.PER_ROUND)).get(0).ties().get(0).home().getName());
    }

    // ---------- Cierre

    private CustomLockService lockService(Instant now) {
        CustomLockService service = new CustomLockService(matches, mock(TeamRepository.class), mock(EditionRepository.class));
        service.setClock(Clock.fixed(now, CustomLockService.ZONE));
        return service;
    }

    @Test
    @DisplayName("Por rondas: la ronda se cierra al empezar su primera ida; la siguiente, sin sortear, sigue abierta")
    void perRoundLocksTheRoundAtItsFirstLeg() {
        playoff(false);

        var before = lockService(PLAYOFF_FIRST.minus(1, ChronoUnit.HOURS)).state(edition(CREATED, PredictionLockMode.PER_ROUND));
        assertFalse(before.anyLocked());
        assertEquals(PLAYOFF_FIRST, before.nextLockAt());
        assertEquals(5, before.knockoutRounds().size());

        var after = lockService(PLAYOFF_FIRST.plus(1, ChronoUnit.HOURS)).state(edition(CREATED, PredictionLockMode.PER_ROUND));
        assertEquals(Collections.nCopies(8, true), after.picks().get(0));
        assertEquals(List.of(), after.picks().get(1));
        assertTrue(after.anyLocked());
        assertFalse(after.fullyLocked());
    }

    @Test
    @DisplayName("Una edición sin cierre por partes se cierra por rondas")
    void fixedDateFallsBackToPerRound() {
        playoff(false);

        var state = lockService(PLAYOFF_FIRST.plus(1, ChronoUnit.HOURS)).state(edition(CREATED, PredictionLockMode.FIXED_DATE));

        assertEquals(PredictionLockMode.PER_ROUND, state.mode());
        assertTrue(state.pickLocked(0, 7));
    }

    @Test
    @DisplayName("Por eliminatorias: cada cruce se cierra al empezar su ida")
    void perMatchLocksEachTie() {
        playoff(false);
        fixtures.get(2).setMatchDate(PLAYOFF_FIRST.plus(1, ChronoUnit.DAYS));

        var state = lockService(PLAYOFF_FIRST.plus(1, ChronoUnit.HOURS)).state(edition(CREATED, PredictionLockMode.PER_MATCH));

        assertTrue(state.pickLocked(0, 0));
        assertFalse(state.pickLocked(0, 1));
    }

    @Test
    @DisplayName("Con la final cerrada ya no queda nada abierto")
    void fullyLockedOnceTheFinalStarts() {
        Instant start = AppTime.fromLocal(LocalDateTime.of(2026, 5, 30, 18, 0));
        leg("final", "A", "B", start, null);

        var state = lockService(start.plus(1, ChronoUnit.HOURS)).state(edition(CREATED, PredictionLockMode.PER_ROUND));

        assertTrue(state.fullyLocked());
        assertNull(state.nextLockAt());
    }

    // ---------- Validación

    private final CustomBracketPredictionValidator validator =
            new CustomBracketPredictionValidator(mock(TeamRepository.class), matches);

    private static PredictionDataDTO picks(List<List<String>> rounds, String champion) {
        PredictionDataDTO data = new PredictionDataDTO();
        data.setCustomRounds(rounds);
        data.setChampion(champion);
        return data;
    }

    private static List<String> row(String... picks) {
        return Arrays.asList(picks);
    }

    @Test
    @DisplayName("Admite elegir solo algunos cruces de una ronda sorteada")
    void acceptsPartialPicks() {
        playoff(false);

        assertDoesNotThrow(() -> validator.validate(edition(CREATED, PredictionLockMode.PER_ROUND),
                picks(List.of(row("P2", null, null, null, null, null, null, "P15")), null)));
    }

    @Test
    @DisplayName("Rechaza un equipo que no juega ese cruce, una ronda sin sortear o un campeón distinto")
    void rejectsInvalidPicks() {
        playoff(false);
        Edition edition = edition(CREATED, PredictionLockMode.PER_ROUND);

        assertThrows(BusinessException.class, () -> validator.validate(edition,
                picks(List.of(row("P3", null, null, null, null, null, null, null)), null)));
        assertThrows(BusinessException.class, () -> validator.validate(edition,
                picks(List.of(row(), row("S1", null, null, null, null, null, null, null)), null)));
        assertThrows(BusinessException.class, () -> validator.validate(edition,
                picks(List.of(row("P1")), null)));
        assertThrows(BusinessException.class, () -> validator.validate(edition,
                picks(List.of(row(null, null, null, null, null, null, null, null)), null)));
        assertThrows(BusinessException.class, () -> validator.validate(edition,
                picks(List.of(row("P1", null, null, null, null, null, null, null)), "P1")));
    }

    @Test
    @DisplayName("El campeón es el elegido en la final")
    void championMustMatchTheFinalPick() {
        Instant start = AppTime.fromLocal(LocalDateTime.of(2026, 5, 30, 18, 0));
        leg("final", "A", "B", start, null);
        Edition edition = edition(start.minus(10, ChronoUnit.DAYS), PredictionLockMode.PER_ROUND);

        assertDoesNotThrow(() -> validator.validate(edition, picks(List.of(row("B")), "B")));
        assertThrows(BusinessException.class, () -> validator.validate(edition, picks(List.of(row("B")), null)));
    }

    // ---------- Puntos

    @Test
    @DisplayName("Suma los puntos de la ronda por cada cruce en el que pasa el elegido")
    void scoresEachQualifierByRound() {
        playoff(true);
        roundOf16();
        Edition edition = edition(CREATED, PredictionLockMode.PER_ROUND);
        Prediction prediction = Prediction.builder().edition(edition).bracketData(picks(List.of(
                row("P1", "P4", "P5", null, null, null, null, null),
                row("S1", null, null, null, null, null, null, null)), null)).build();

        var score = new CustomBracketScoringService(matches, mock(TeamRepository.class)).score(prediction);

        // P1 y P5 pasan (la ida la ganaron P2 y P6): 2 × 25 de dieciseisavos; octavos aún sin jugar.
        assertEquals(50, score.getTotal());
        assertEquals(50, score.getR32());
        assertEquals(2, score.getLog().size());
    }

    @Test
    @DisplayName("Champions y Copa del Rey se sortean ronda a ronda; los Worlds de LoL y el Mundial no")
    void whichCompetitionsDrawTheirRounds() {
        assertTrue(champions.drawsKnockoutRounds());
        assertTrue(Competition.builder().externalId("esp.copa_del_rey").formatType("TOURNAMENT").build().drawsKnockoutRounds());
        assertFalse(Competition.builder().externalId("esp.1").formatType("LEAGUE").build().hasOwnBracket());
        assertFalse(Competition.builder().externalId("lol.worlds").formatType("TOURNAMENT").build().drawsKnockoutRounds());
        assertFalse(Competition.builder().externalId(Competition.WORLD_CUP_EXTERNAL_ID).formatType("TOURNAMENT").build()
                .hasOwnBracket());
    }
}
