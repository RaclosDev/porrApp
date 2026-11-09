package app.porrapp.service.league;

import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.MatchSelectionMode;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.TennisScope;
import app.porrapp.repository.MatchRepository;
import app.porrapp.service.prediction.MatchSelectionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LeagueClosureTest {

    private static final Instant NOW = Instant.parse("2026-07-20T10:00:00Z");
    private static final Instant CREATED = NOW.minus(Duration.ofDays(60));

    @Mock private MatchRepository matchRepository;
    @Mock private MatchSelectionService matchSelectionService;

    @InjectMocks private LeagueClosure closure;

    private static Competition competition(String externalId, String formatType) {
        return Competition.builder().id(3L).externalId(externalId).formatType(formatType).build();
    }

    private static Edition edition(Competition competition) {
        return Edition.builder().competition(competition).poolFormat(PoolFormat.MATCH_DAY)
                .createdAt(CREATED).status("ACTIVE").build();
    }

    private static Match played(Competition competition, String round, Duration ago) {
        return Match.builder().competition(competition).round(round).finished(true)
                .status(MatchStatusNormalized.FINISHED).matchDate(ago == null ? null : NOW.minus(ago)).build();
    }

    private static Match pending(Competition competition, String round) {
        return Match.builder().competition(competition).round(round).finished(false)
                .matchDate(NOW.plus(Duration.ofDays(3))).build();
    }

    @Test
    @DisplayName("Una liga regular termina en cuanto se juega su último partido")
    void regularLeagueEndsWithItsLastMatch() {
        Competition laLiga = competition("esp.1", "LEAGUE");
        List<Match> calendar = List.of(played(laLiga, "Jornada 37", Duration.ofDays(8)),
                played(laLiga, "Jornada 38", Duration.ofHours(3)));

        assertThat(LeagueClosure.isFinished(edition(laLiga), calendar, NOW)).isTrue();
    }

    @Test
    @DisplayName("Con un partido por jugar no ha terminado; uno cancelado no la deja abierta")
    void pendingMatchKeepsItOpenButCancelledDoesNot() {
        Competition laLiga = competition("esp.1", "LEAGUE");
        Match last = played(laLiga, "Jornada 38", Duration.ofHours(3));
        Match cancelled = Match.builder().competition(laLiga).round("Jornada 20").finished(false)
                .status(MatchStatusNormalized.CANCELLED).build();

        assertThat(LeagueClosure.isFinished(edition(laLiga), List.of(last, pending(laLiga, "Jornada 38")), NOW))
                .isFalse();
        assertThat(LeagueClosure.isFinished(edition(laLiga), List.of(last, cancelled), NOW)).isTrue();
        assertThat(LeagueClosure.isFinished(edition(laLiga), List.of(), NOW)).isFalse();
    }

    @Test
    @DisplayName("Un torneo termina con su final, no entre ronda y ronda")
    void tournamentEndsWithItsFinal() {
        Competition cup = competition("esp.copa_del_rey", "TOURNAMENT");
        Match semi = played(cup, "sf", Duration.ofDays(3));

        // Semifinales jugadas y la final aún sin importar: el proveedor todavía no la ha publicado.
        assertThat(LeagueClosure.isFinished(edition(cup), List.of(semi), NOW)).isFalse();
        assertThat(LeagueClosure.isFinished(edition(cup), List.of(semi, played(cup, "final", Duration.ofHours(2))),
                NOW)).isTrue();
    }

    @Test
    @DisplayName("La Champions por jornadas no termina con su fase de liga: faltan las eliminatorias")
    void leagueWithKnockoutsWaitsForTheFinal() {
        Competition champions = competition("uefa.champions", "LEAGUE");
        Match leaguePhase = played(champions, "Jornada 8", Duration.ofDays(2));

        assertThat(LeagueClosure.isFinished(edition(champions), List.of(leaguePhase), NOW)).isFalse();
        assertThat(LeagueClosure.isFinished(edition(champions),
                List.of(leaguePhase, played(champions, "final", Duration.ofHours(2))), NOW)).isTrue();
    }

    @Test
    @DisplayName("Sin final ni calendario fijo (UFC) espera una semana por si llega otra velada")
    void openEndedCalendarWaitsForTheMargin() {
        Competition ufc = competition("mma.ufc", Competition.EVENTS_FORMAT);

        assertThat(LeagueClosure.isFinished(edition(ufc),
                List.of(played(ufc, "UFC 330: Finale", Duration.ofDays(2))), NOW)).isFalse();
        assertThat(LeagueClosure.isFinished(edition(ufc),
                List.of(played(ufc, "UFC 330: Finale", Duration.ofDays(8))), NOW)).isTrue();
    }

    @Test
    @DisplayName("Una liga creada con la temporada ya jugada espera a la siguiente")
    void leagueCreatedAfterTheSeasonIsNotFinished() {
        Competition playoffs = competition("nba", "TOURNAMENT");
        Match lastFinals = played(playoffs, "final", Duration.ofDays(90));

        assertThat(LeagueClosure.isFinished(edition(playoffs), List.of(lastFinals), NOW)).isFalse();
    }

    @Test
    @DisplayName("Un cuadro personalizado termina al jugarse su final, aunque no tenga fechas")
    void customBracketEndsWithItsLastRound() {
        Competition custom = Competition.builder().id(9L).formatType("TOURNAMENT")
                .ownerLeague(League.builder().id(1L).build()).build();
        Match semiA = played(custom, "bracket-1", null);
        Match semiB = played(custom, "bracket-1", null);

        assertThat(LeagueClosure.isFinished(edition(custom), List.of(semiA, semiB), NOW)).isFalse();
        assertThat(LeagueClosure.isFinished(edition(custom),
                List.of(semiA, semiB, played(custom, "bracket-2", null)), NOW)).isTrue();
    }

    @Test
    @DisplayName("Una competición personalizada por jornadas espera el margen: su administrador puede añadir partidos")
    void customMatchdaysWaitForTheMargin() {
        Competition custom = Competition.builder().id(9L).formatType("LEAGUE")
                .ownerLeague(League.builder().id(1L).build()).build();

        assertThat(LeagueClosure.isFinished(edition(custom),
                List.of(played(custom, "Jornada 1", Duration.ofDays(1))), NOW)).isFalse();
        // Vale aunque sus partidos sean anteriores a la liga: la competición es suya y no hay otra temporada.
        assertThat(LeagueClosure.isFinished(edition(custom),
                List.of(played(custom, "Jornada 1", Duration.ofDays(90))), NOW)).isTrue();
    }

    @Test
    @DisplayName("Una liga en juego se descarta con una consulta, sin cargar su calendario")
    void ongoingLeagueIsRuledOutWithoutLoadingItsCalendar() {
        Competition laLiga = competition("esp.1", "LEAGUE");
        when(matchRepository.existsOpenInCompetitions(List.of(3L))).thenReturn(true);

        assertThat(closure.isFinished(edition(laLiga), NOW)).isFalse();
        verify(matchRepository, never()).findByCompetitionId(any());
    }

    @Test
    @DisplayName("Con todo jugado mira el calendario de la competición")
    void finishedCompetitionIsCheckedOnItsCalendar() {
        Competition laLiga = competition("esp.1", "LEAGUE");
        when(matchRepository.existsOpenInCompetitions(List.of(3L))).thenReturn(false);
        when(matchRepository.findByCompetitionId(3L))
                .thenReturn(List.of(played(laLiga, "Jornada 38", Duration.ofHours(3))));

        assertThat(closure.isFinished(edition(laLiga), NOW)).isTrue();
    }

    @Test
    @DisplayName("Si la liga elige partidos, termina con los suyos aunque la competición siga")
    void leagueWithChosenMatchesEndsWithItsOwn() {
        Competition laLiga = competition("esp.1", "LEAGUE");
        Edition edition = edition(laLiga);
        edition.setMatchSelection(MatchSelectionMode.CUSTOM);
        when(matchSelectionService.leagueCalendar(any(), any()))
                .thenReturn(List.of(played(laLiga, "Jornada 10", Duration.ofHours(3))));

        assertThat(closure.isFinished(edition, NOW)).isTrue();
        verify(matchRepository, never()).existsOpenInCompetitions(any());
    }

    @Test
    @DisplayName("Sin competición o en tenis de varios torneos no se da por terminada")
    void noCompetitionOrTennisSeasonIsNeverFinished() {
        Edition tennis = edition(competition("tennis.atp.188", "TOURNAMENT"));
        tennis.setTennisScope(TennisScope.GRAND_SLAMS);

        assertThat(closure.isFinished(null, NOW)).isFalse();
        assertThat(closure.isFinished(Edition.builder().build(), NOW)).isFalse();
        assertThat(closure.isFinished(tennis, NOW)).isFalse();
        verifyNoInteractions(matchRepository);
    }
}
