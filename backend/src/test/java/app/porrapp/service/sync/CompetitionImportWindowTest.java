package app.porrapp.service.sync;

import app.porrapp.sports.SportsDataProvider.SeasonWindow;
import app.porrapp.util.AppTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class CompetitionImportWindowTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 7);

    @Test
    @DisplayName("Importa la temporada que da el proveedor, entera aunque empezara hace meses")
    void usesTheProviderSeason() {
        var window = CompetitionImportService.seasonWindow(
                new SeasonWindow("2026-06-05T04:00Z", "2027-07-01T03:59Z"), TODAY);

        assertThat(window.start()).isEqualTo(Instant.parse("2026-06-05T04:00:00Z"));
        assertThat(window.end()).isEqualTo(Instant.parse("2027-07-01T03:59:00Z"));
    }

    @Test
    @DisplayName("Una liga de año natural se importa desde enero")
    void calendarYearLeaguesStartInJanuary() {
        var window = CompetitionImportService.seasonWindow(
                new SeasonWindow("2026-01-01T10:00Z", "2026-12-31T04:59Z"), TODAY);

        assertThat(AppTime.day(window.start())).isEqualTo(LocalDate.of(2026, 1, 1));
    }

    @Test
    @DisplayName("Sin temporada del proveedor, tres meses atrás y un año adelante")
    void fallsBackWithoutProviderSeason() {
        for (SeasonWindow season : new SeasonWindow[]{null, new SeasonWindow("no es fecha", "2027-01-01T00:00Z")}) {
            var window = CompetitionImportService.seasonWindow(season, TODAY);
            assertThat(window.start()).isEqualTo(AppTime.startOfDay(TODAY.minusMonths(3)));
            assertThat(window.end()).isEqualTo(AppTime.startOfDay(TODAY.plusMonths(12)));
        }
    }

    @Test
    @DisplayName("Una temporada muy larga se acota a un año a cada lado")
    void clampsVeryLongSeasons() {
        var window = CompetitionImportService.seasonWindow(
                new SeasonWindow("2020-01-01T00:00Z", "2030-01-01T00:00Z"), TODAY);

        assertThat(window.start()).isEqualTo(AppTime.startOfDay(TODAY.minusMonths(12)));
        assertThat(window.end()).isEqualTo(AppTime.startOfDay(TODAY.plusMonths(12)));
    }
}
