package app.porrapp.service.league;

import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.LeagueRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class LeagueSeasonsTest {

    private final CompetitionRepository competitions = mock(CompetitionRepository.class);
    private final LeagueRepository leagues = mock(LeagueRepository.class);
    private final LeagueSeasons seasons = new LeagueSeasons(competitions, leagues);

    private final League league = League.builder().id(10L).name("Los del barrio").joinCode("BARRIO").build();
    private final Competition played = Competition.builder().id(1L).name("LaLiga").externalId("esp.1")
            .season("2025/26").archivedAt(Instant.parse("2026-08-01T00:00:00Z")).build();
    private final Competition current = Competition.builder().id(2L).name("LaLiga").externalId("esp.1")
            .season("2026/27").build();

    @Test
    @DisplayName("Una liga en juego solo dice su temporada, sin consultar nada más")
    void aLeagueInPlayOnlyTellsItsSeason() {
        LeagueSeasons.Status status = seasons.status(league, edition(current), id -> true);

        assertThat(status).isEqualTo(new LeagueSeasons.Status("2026/27", false, false, null, null));
        verifyNoInteractions(leagues);
    }

    @Test
    @DisplayName("Terminada y con temporada nueva, se puede repetir")
    void anEndedLeagueWithANewSeasonCanBeRepeated() {
        when(competitions.findByExternalId("esp.1")).thenReturn(Optional.of(current));

        assertThat(seasons.status(league, edition(played), id -> true))
                .isEqualTo(new LeagueSeasons.Status("2025/26", true, true, "2026/27", null));
    }

    @Test
    @DisplayName("Terminada pero sin temporada nueva todavía, no se puede repetir")
    void anEndedLeagueWithoutANewSeasonWaits() {
        when(competitions.findByExternalId("esp.1")).thenReturn(Optional.empty());

        assertThat(seasons.status(league, edition(played), id -> true))
                .isEqualTo(new LeagueSeasons.Status("2025/26", true, false, null, null));
    }

    @Test
    @DisplayName("Ya repetida: la liga nueva solo se nombra a quien pertenece a ella")
    void theNextLeagueIsOnlyNamedToItsMembers() {
        when(competitions.findByExternalId("esp.1")).thenReturn(Optional.of(current));
        when(leagues.findByPreviousLeagueId(10L))
                .thenReturn(Optional.of(League.builder().id(11L).name("Los del barrio").joinCode("NUEVA").build()));

        assertThat(seasons.status(league, edition(played), id -> id.equals(11L)))
                .isEqualTo(new LeagueSeasons.Status("2025/26", true, false, null, 11L));
        assertThat(seasons.status(league, edition(played), id -> false))
                .isEqualTo(new LeagueSeasons.Status("2025/26", true, false, null, null));
    }

    @Test
    @DisplayName("Una liga de varias competiciones no termina hasta que se archivan todas")
    void aMultiCompetitionLeagueEndsWithItsLastCompetition() {
        Competition cup = Competition.builder().id(3L).name("Copa").externalId("esp.copa").season("2025/26").build();
        Edition edition = edition(played);
        edition.setId(7L);
        edition.setMultiCompetition(true);
        when(competitions.findByEditionId(7L)).thenReturn(List.of(played, cup));

        assertThat(seasons.ended(edition)).isFalse();
        assertThat(seasons.status(league, edition, id -> true).canRepeat()).isFalse();

        cup.setArchivedAt(Instant.parse("2026-08-02T00:00:00Z"));
        assertThat(seasons.ended(edition)).isTrue();
    }

    @Test
    @DisplayName("Una competición propia de la liga no tiene temporadas")
    void aCustomCompetitionHasNoSeasons() {
        Competition own = Competition.builder().id(4L).name("Torneo del barrio").ownerLeague(league).build();

        assertThat(seasons.status(league, edition(own), id -> true)).isEqualTo(LeagueSeasons.Status.NONE);
        assertThat(seasons.status(league, null, id -> true)).isEqualTo(LeagueSeasons.Status.NONE);
    }

    private Edition edition(Competition competition) {
        return Edition.builder().league(league).competition(competition).status("ACTIVE").build();
    }
}
