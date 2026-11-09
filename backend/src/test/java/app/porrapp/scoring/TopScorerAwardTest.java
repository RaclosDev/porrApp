package app.porrapp.scoring;

import app.porrapp.dto.TopScorerDTO;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TopScorerAwardTest {

    private static final TopScorerDTO MBAPPE = scorer("1", "Kylian Mbappé", "K. Mbappé", 31);
    private static final TopScorerDTO LEWANDOWSKI = scorer("2", "Robert Lewandowski", "R. Lewandowski", 27);
    private static final TopScorerDTO GONCALO = scorer("11", "Gonçalo Ramos", "G. Ramos", 31);
    private static final TopScorerDTO SERGIO = scorer("12", "Sergio Ramos", "S. Ramos", 2);

    private static TopScorerDTO scorer(String id, String name, String shortName, int goals) {
        return new TopScorerDTO(name, shortName, goals, "F", id, "Equipo", "");
    }

    private static Integer points(ScorerChoice choice, TopScorerDTO... scorers) {
        TopScorerAward.Award award = TopScorerAward.evaluate(choice, List.of(scorers), null, 200);
        return award == null ? null : award.points();
    }

    @Test
    @DisplayName("Elegido de la lista o escrito de cualquier forma, el mismo jugador da los mismos puntos")
    void theSamePlayerScoresTheSameHoweverItWasChosen() {
        ScorerChoice fromList = new ScorerChoice("Kylian Mbappé", "1", "Kylian Mbappé", false);

        assertThat(points(fromList, MBAPPE, LEWANDOWSKI)).isEqualTo(200);
        assertThat(points(ScorerChoice.written("Mbappé"), MBAPPE, LEWANDOWSKI)).isEqualTo(200);
        assertThat(points(ScorerChoice.written("mbape"), MBAPPE, LEWANDOWSKI)).isEqualTo(200);
        assertThat(points(ScorerChoice.written("K. MBAPPE"), MBAPPE, LEWANDOWSKI)).isEqualTo(200);
        assertThat(points(ScorerChoice.written("Lewandowski"), MBAPPE, LEWANDOWSKI)).isNull();
    }

    @Test
    @DisplayName("El jugador elegido de la lista cuenta por su id, no por lo que diga el nombre")
    void aChosenPlayerCountsByItsId() {
        // Escrito sería dudoso entre los dos Ramos; con el jugador elegido no hay duda.
        assertThat(points(ScorerChoice.written("Ramos"), GONCALO, SERGIO)).isNull();
        assertThat(points(new ScorerChoice("Ramos", "11", "Gonçalo Ramos", false), GONCALO, SERGIO)).isEqualTo(200);
        assertThat(points(new ScorerChoice("Ramos", "12", "Sergio Ramos", false), GONCALO, SERGIO)).isNull();
    }

    @Test
    @DisplayName("El jugador que asigna el administrador manda sobre lo escrito y sale en el desglose")
    void theAdminAssignedPlayerWins() {
        ScorerChoice assigned = new ScorerChoice("el bicho ese", "1", "Kylian Mbappé", true);

        TopScorerAward.Award award = TopScorerAward.evaluate(assigned, List.of(MBAPPE, LEWANDOWSKI), null, 200);

        assertThat(award.points()).isEqualTo(200);
        assertThat(award.message()).isEqualTo("Pichichi: Kylian Mbappé (asignado por el administrador) acertado");
        // Asignado a quien no es el máximo goleador, no puntúa aunque lo escrito sí lo fuera.
        assertThat(points(new ScorerChoice("Mbappé", "2", "Robert Lewandowski", true), MBAPPE, LEWANDOWSKI)).isNull();
    }

    @Test
    @DisplayName("Sin id en alguno de los dos, el jugador elegido se compara por el nombre")
    void withoutIdsTheChosenPlayerIsComparedByName() {
        TopScorerDTO withoutId = scorer("", "Kylian Mbappé", "K. Mbappé", 31);

        assertThat(points(new ScorerChoice("Mbappé", "1", "Kylian Mbappe", false), withoutId, LEWANDOWSKI)).isEqualTo(200);
        assertThat(points(new ScorerChoice("Mbappé", null, "Kylian Mbappé", true), MBAPPE, LEWANDOWSKI)).isEqualTo(200);
    }

    @Test
    @DisplayName("Los empatados en cabeza se reparten los puntos")
    void tiedLeadersSplitThePoints() {
        TopScorerAward.Award award = TopScorerAward.evaluate(ScorerChoice.written("Mbappé"),
                List.of(MBAPPE, GONCALO, LEWANDOWSKI), null, 200);

        assertThat(award.points()).isEqualTo(100);
        assertThat(award.message()).isEqualTo("Pichichi: Mbappé acertado (100 pts repartidos)");
    }

    @Test
    @DisplayName("Sin pichichi elegido, sin goleadores o con la regla a cero no hay puntos")
    void nothingToAward() {
        assertThat(points(ScorerChoice.written(" "), MBAPPE)).isNull();
        assertThat(points(null, MBAPPE)).isNull();
        assertThat(TopScorerAward.evaluate(ScorerChoice.written("Mbappé"), List.of(), null, 200)).isNull();
        assertThat(TopScorerAward.evaluate(ScorerChoice.written("Mbappé"), List.of(MBAPPE), null, 0)).isNull();
    }

    @Test
    @DisplayName("Sin lista de goleadores valen los nombres oficiales separados por comas")
    void fallsBackToTheOfficialNames() {
        TopScorerAward.Award award = TopScorerAward.evaluate(ScorerChoice.written("kane"), List.of(),
                "Kylian Mbappé, Harry Kane", 200);

        assertThat(award.points()).isEqualTo(100);
    }
}
