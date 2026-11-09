package app.porrapp.service.tournament;

import app.porrapp.dto.ScorerCandidateDTO;
import app.porrapp.dto.TopScorerDTO;
import app.porrapp.model.Competition;
import app.porrapp.model.CompetitionPlayer;
import app.porrapp.model.League;
import app.porrapp.repository.CompetitionPlayerRepository;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.EditionRepository;
import app.porrapp.sports.SportsDataProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CompetitionPlayerServiceTest {

    @Mock private SportsDataProvider provider;
    @Mock private CompetitionPlayerRepository playerRepository;
    @Mock private CompetitionRepository competitionRepository;
    @Mock private EditionRepository editionRepository;
    @Mock private TopScorerService topScorerService;

    private final ObjectMapper json = new ObjectMapper();
    private final Competition laLiga = Competition.builder().id(7L).name("LaLiga").externalId("esp.1")
            .formatType("LEAGUE").season("2026/27").build();
    private CompetitionPlayerService service;

    @BeforeEach
    void setUp() throws Exception {
        service = service(true);
        when(provider.supports("esp.1")).thenReturn(true);
        when(provider.isAvailable()).thenReturn(true);
        when(provider.fetchTeams("esp.1")).thenReturn(json.readTree("""
                [{"team": {"id": "86", "displayName": "Real Madrid"}},
                 {"team": {"id": "83", "displayName": "Barcelona"}}]"""));
        when(provider.fetchTeamRoster("esp.1", "86")).thenReturn(json.readTree("""
                [{"id": "231388", "displayName": "Kylian Mbappé", "shortName": "K. Mbappé",
                  "position": {"abbreviation": "F"}},
                 {"id": "", "displayName": "Sin id"},
                 {"id": "9", "displayName": " "}]"""));
        when(provider.fetchTeamRoster("esp.1", "83")).thenReturn(json.readTree("""
                [{"id": "45843", "displayName": "Robert Lewandowski", "shortName": "R. Lewandowski",
                  "position": {"abbreviation": "F"}}]"""));
        when(topScorerService.getTopScorers(any(Competition.class))).thenReturn(List.of());
    }

    private CompetitionPlayerService service(boolean refreshEnabled) {
        return new CompetitionPlayerService(provider, playerRepository, competitionRepository, editionRepository,
                topScorerService, refreshEnabled);
    }

    @Test
    @DisplayName("Guarda la plantilla de cada equipo; los que ya estaban se actualizan y ninguno se borra")
    void savesTheSquadOfEveryTeam() throws Exception {
        CompetitionPlayer known = CompetitionPlayer.builder().id(1L).competitionId(7L).playerId("231388")
                .name("Kylian Mbappe").shortName("K. Mbappe").team("Paris Saint-Germain").playerPosition("F")
                .fetchedAt(Instant.now().minus(40, ChronoUnit.DAYS)).build();
        when(playerRepository.findByCompetitionId(7L)).thenReturn(List.of(known));

        int saved = service.refresh(laLiga);

        assertThat(saved).isEqualTo(2);
        List<CompetitionPlayer> players = List.copyOf(savedPlayers());
        assertThat(players).extracting(CompetitionPlayer::getName)
                .containsExactly("Kylian Mbappé", "Robert Lewandowski");
        assertThat(players.get(0)).isSameAs(known);
        assertThat(known.getTeam()).isEqualTo("Real Madrid");
        assertThat(known.getFetchedAt()).isAfter(Instant.now().minus(1, ChronoUnit.MINUTES));
        assertThat(players.get(1).getCompetitionId()).isEqualTo(7L);
        assertThat(players.get(1).getPlayerId()).isEqualTo("45843");
        assertThat(players.get(1).getShortName()).isEqualTo("R. Lewandowski");
        verify(playerRepository, never()).delete(any());
        verify(playerRepository, never()).deleteAll(any());
    }

    @Test
    @DisplayName("Un equipo sin plantilla no impide guardar las de los demás")
    void aTeamWithoutSquadDoesNotBlockTheRest() throws Exception {
        when(provider.fetchTeamRoster("esp.1", "86")).thenThrow(new IOException("404"));

        assertThat(service.refresh(laLiga)).isEqualTo(1);
        assertThat(savedPlayers()).extracting(CompetitionPlayer::getName).containsExactly("Robert Lewandowski");
    }

    @Test
    @DisplayName("Sin equipos o con un catálogo desmesurado no se guarda nada")
    void nothingIsSavedWithoutTeams() throws Exception {
        when(provider.fetchTeams("esp.1")).thenReturn(null);

        assertThat(service.refresh(laLiga)).isZero();
        verify(playerRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("Las plantillas se piden si faltan o son de hace más de un día, y tras un intento no se insiste")
    void squadsAreRequestedOnlyWhenStale() throws Exception {
        when(editionRepository.findCompetitionsWithPichichi()).thenReturn(List.of(laLiga));
        when(playerRepository.lastFetchedAt(7L)).thenReturn(null);

        service.scheduledRefresh();
        service.scheduledRefresh();

        verify(provider, times(1)).fetchTeams("esp.1");

        CompetitionPlayerService fresh = service(true);
        when(playerRepository.lastFetchedAt(7L)).thenReturn(Instant.now().minus(2, ChronoUnit.HOURS));
        fresh.scheduledRefresh();
        verify(provider, times(1)).fetchTeams("esp.1");

        when(playerRepository.lastFetchedAt(7L)).thenReturn(Instant.now().minus(30, ChronoUnit.HOURS));
        fresh.scheduledRefresh();
        verify(provider, times(2)).fetchTeams("esp.1");
    }

    @Test
    @DisplayName("Una liga nueva con pichichi pide las plantillas al momento; sin pichichi, no")
    void aNewLeagueRequestsSquadsAtOnce() throws Exception {
        when(playerRepository.lastFetchedAt(7L)).thenReturn(null);
        when(editionRepository.findCompetitionsWithPichichi()).thenReturn(List.of());
        service.refreshForNewLeague(7L);
        verify(provider, never()).fetchTeams("esp.1");

        when(editionRepository.findCompetitionsWithPichichi()).thenReturn(List.of(laLiga));
        service.refreshForNewLeague(7L);
        verify(provider, times(1)).fetchTeams("esp.1");
    }

    @Test
    @DisplayName("Un fallo del proveedor no rompe la pasada ni se reintenta enseguida")
    void aProviderFailureIsNotRetriedAtOnce() throws Exception {
        when(editionRepository.findCompetitionsWithPichichi()).thenReturn(List.of(laLiga));
        when(provider.fetchTeams("esp.1")).thenThrow(new IOException("ESPN caído"));

        service.scheduledRefresh();
        service.scheduledRefresh();

        verify(provider, times(1)).fetchTeams("esp.1");
        verify(playerRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("No se piden plantillas de otros deportes, de competiciones propias, archivadas o que el proveedor no sigue")
    void onlyCurrentOfficialFootballCompetitionsHaveSquads() throws Exception {
        Competition nba = Competition.builder().id(1L).name("NBA").externalId(Competition.NBA_EXTERNAL_ID).build();
        Competition own = Competition.builder().id(2L).name("Torneo del barrio").externalId("esp.1")
                .ownerLeague(League.builder().id(5L).build()).build();
        Competition archived = Competition.builder().id(3L).name("LaLiga 25/26").externalId("esp.1")
                .archivedAt(Instant.now()).build();
        Competition unknown = Competition.builder().id(4L).name("Liga sin proveedor").externalId("xxx.1").build();
        when(provider.supports(Competition.NBA_EXTERNAL_ID)).thenReturn(true);

        for (Competition competition : List.of(nba, own, archived, unknown)) service.refreshIfStale(competition);

        verify(provider, never()).fetchTeams(anyString());
    }

    @Test
    @DisplayName("Apagado, el refresco programado no pide nada")
    void theScheduledRefreshCanBeTurnedOff() {
        service(false).scheduledRefresh();

        verifyNoInteractions(editionRepository, provider);
    }

    @Test
    @DisplayName("La lista para elegir une plantillas y goleadores, con sus goles y por orden alfabético")
    void theListMergesSquadsAndScorers() {
        when(competitionRepository.findById(7L)).thenReturn(Optional.of(laLiga));
        when(playerRepository.findByCompetitionId(7L)).thenReturn(List.of(
                player("45843", "Robert Lewandowski", "Barcelona"), player("231388", "Kylian Mbappé", "Real Madrid")));
        when(topScorerService.getTopScorers(laLiga)).thenReturn(List.of(
                new TopScorerDTO("Kylian Mbappé", "K. Mbappé", 12, "F", "231388", "Real Madrid", ""),
                // Traspasado en invierno: ya no está en ninguna plantilla, pero sus goles cuentan.
                new TopScorerDTO("Ante Budimir", "A. Budimir", 9, "F", "150", "Osasuna", "")));

        List<ScorerCandidateDTO> players = service.players(7L);

        assertThat(players).extracting(ScorerCandidateDTO::name)
                .containsExactly("Ante Budimir", "Kylian Mbappé", "Robert Lewandowski");
        assertThat(players).extracting(ScorerCandidateDTO::goals).containsExactly(9, 12, 0);
        assertThat(players.get(1).team()).isEqualTo("Real Madrid");
        assertThat(service.players(99L)).isEmpty();
    }

    @Test
    @DisplayName("Se sabe si hay plantillas por la fecha de la última que llegó")
    void squadsAreKnownOnceFetched() {
        when(playerRepository.lastFetchedAt(7L)).thenReturn(null);
        assertThat(service.squadsKnown(laLiga)).isFalse();

        when(playerRepository.lastFetchedAt(7L)).thenReturn(Instant.now());
        assertThat(service.squadsKnown(laLiga)).isTrue();
        assertThat(service.squadsKnown(null)).isFalse();
    }

    private static CompetitionPlayer player(String id, String name, String team) {
        return CompetitionPlayer.builder().competitionId(7L).playerId(id).name(name).shortName(name).team(team)
                .playerPosition("F").fetchedAt(Instant.now()).build();
    }

    @SuppressWarnings("unchecked")
    private Collection<CompetitionPlayer> savedPlayers() {
        ArgumentCaptor<Iterable<CompetitionPlayer>> saved = ArgumentCaptor.forClass(Iterable.class);
        verify(playerRepository).saveAll(saved.capture());
        return (Collection<CompetitionPlayer>) saved.getValue();
    }
}
