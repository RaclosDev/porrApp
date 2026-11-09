package app.porrapp.service.sync;

import app.porrapp.model.Competition;
import app.porrapp.model.League;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.service.prediction.MatchSelectionService;
import app.porrapp.service.tournament.KnockoutBracketService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.scheduling.annotation.Scheduled;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SeasonCalendarRefresherTest {

    private final CompetitionRepository competitions = mock(CompetitionRepository.class);
    private final CompetitionImportService imports = mock(CompetitionImportService.class);
    private final ConcurrentMapCacheManager caches = new ConcurrentMapCacheManager("competitions", "matches");
    private final MatchSelectionService selections = mock(MatchSelectionService.class);
    private final KnockoutBracketService knockout = mock(KnockoutBracketService.class);
    private final SeasonCalendarRefresher refresher = new SeasonCalendarRefresher(competitions, imports, caches,
            selections, knockout);

    @Test
    @DisplayName("Carga todas las competiciones oficiales, aunque una falle, y no las personalizadas")
    void refreshesEveryOfficialCompetition() {
        when(competitions.findAll()).thenReturn(List.of(
                Competition.builder().id(1L).name("LaLiga").externalId("esp.1").build(),
                Competition.builder().id(2L).name("Premier").externalId("eng.1").build(),
                Competition.builder().id(3L).name("Torneo del barrio").ownerLeague(League.builder().id(9L).build()).build(),
                Competition.builder().id(4L).name("Sin proveedor").externalId(" ").build(),
                Competition.builder().id(5L).name("Worlds").externalId("lol.worlds").build()));
        when(imports.importCompetitionData(1L)).thenThrow(new IllegalStateException("ESPN caído"));
        when(imports.importCompetitionData(2L)).thenReturn(new CompetitionImportService.ImportResult("Premier", 20, 380));
        when(imports.importCompetitionData(5L)).thenReturn(new CompetitionImportService.ImportResult("Worlds", 16, 80));
        caches.getCache("competitions").put("all", "viejo");

        refresher.refreshAllSeasons();

        verify(imports).importCompetitionData(2L);
        verify(imports).importCompetitionData(5L);
        verify(imports, never()).importCompetitionData(3L);
        verify(imports, never()).importCompetitionData(4L);
        assertThat(caches.getCache("competitions").get("all")).isNull();
    }

    @Test
    @DisplayName("Un torneo con grupos ya cerrado no se vuelve a importar; mientras se juega, sí")
    void skipsTheWorldCupOnceItIsOver() {
        Competition worldCup = Competition.builder().id(7L).name("Mundial")
                .externalId(Competition.WORLD_CUP_EXTERNAL_ID).build();
        when(competitions.findAll()).thenReturn(List.of(worldCup,
                Competition.builder().id(2L).name("Premier").externalId("eng.1").build()));
        when(imports.importCompetitionData(2L)).thenReturn(new CompetitionImportService.ImportResult("Premier", 20, 380));
        when(imports.importCompetitionData(7L)).thenReturn(new CompetitionImportService.ImportResult("Mundial", 48, 104));

        when(knockout.isOver(worldCup)).thenReturn(true);
        refresher.refreshAllSeasons();
        verify(imports, never()).importCompetitionData(7L);
        verify(imports).importCompetitionData(2L);

        when(knockout.isOver(worldCup)).thenReturn(false);
        refresher.refreshAllSeasons();
        verify(imports).importCompetitionData(7L);
    }

    @Test
    @DisplayName("Corre una vez al día a las 5:00 de Madrid")
    void runsDailyAtFiveInMadrid() throws Exception {
        Scheduled scheduled = SeasonCalendarRefresher.class.getMethod("refreshAllSeasons").getAnnotation(Scheduled.class);
        assertThat(scheduled.cron()).isEqualTo("0 0 5 * * *");
        assertThat(scheduled.zone()).isEqualTo("Europe/Madrid");
    }
}
