package app.porrapp.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TournamentFormatTest {

    @Test
    @DisplayName("El Mundial 2026 es una entrada del registro: 12 grupos, 8 terceros y cuadro desde dieciseisavos")
    void theWorldCupIsARegistryEntry() {
        TournamentFormat format = TournamentFormat.registered(Competition.WORLD_CUP_EXTERNAL_ID);

        assertThat(format.groups()).containsExactly("A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L");
        assertThat(format.bestThirds()).isEqualTo(8);
        assertThat(format.firstRound()).isEqualTo(KnockoutRound.ROUND_OF_32);
        assertThat(format.rounds()).containsExactly(KnockoutRound.ROUND_OF_32, KnockoutRound.ROUND_OF_16,
                KnockoutRound.QUARTER_FINAL, KnockoutRound.SEMI_FINAL);
        assertThat(format.thirdPlaceMatch()).isTrue();
        assertThat(format.firstKnockoutRound().get(0)).containsExactly("1E", "3ABCDF");
    }

    @Test
    @DisplayName("Una Eurocopa tiene otra forma: 6 grupos, 4 terceros, cuadro desde octavos y sin tercer puesto")
    void aEuropeanChampionshipHasAnotherShape() {
        TournamentFormat format = TournamentFormat.registered("uefa.euro");

        assertThat(format.groups()).containsExactly("A", "B", "C", "D", "E", "F");
        assertThat(format.bestThirds()).isEqualTo(4);
        assertThat(format.firstRound()).isEqualTo(KnockoutRound.ROUND_OF_16);
        assertThat(format.rounds()).containsExactly(KnockoutRound.ROUND_OF_16, KnockoutRound.QUARTER_FINAL,
                KnockoutRound.SEMI_FINAL);
        assertThat(format.thirdPlaceMatch()).isFalse();
        assertThat(format.firstKnockoutRound()).hasSize(8);
    }

    @Test
    @DisplayName("Cada tercero que pasa tiene un hueco en la primera ronda, y cada puesto de grupo aparece una vez")
    void everyRegisteredFormatIsConsistent() {
        for (String externalId : TournamentFormat.registeredExternalIds()) {
            TournamentFormat format = TournamentFormat.registered(externalId);
            List<String> slots = format.firstKnockoutRound().stream().flatMap(List::stream).toList();

            assertThat(slots.stream().filter(slot -> slot.startsWith("3"))).as(externalId).hasSize(format.bestThirds());
            for (String group : format.groups()) {
                assertThat(slots).as(externalId).containsOnlyOnce("1" + group).containsOnlyOnce("2" + group);
            }
            assertThat(slots).as(externalId).hasSize(format.groups().size() * 2 + format.bestThirds());
        }
    }

    @Test
    @DisplayName("Una competición sin formato registrado no es un torneo con grupos que se prediga entero")
    void otherCompetitionsHaveNoFormat() {
        assertThat(TournamentFormat.registered(Competition.builder().externalId("esp.1").build())).isNull();
        assertThat(TournamentFormat.of(Competition.builder().externalId("esp.1").build()).rounds()).isEmpty();
        assertThat(Competition.builder().externalId("UEFA.EURO").build().isGroupTournament()).isTrue();
    }
}
