package app.porrapp.scoring;

import app.porrapp.scoring.ScorerNameMatcher.Player;
import app.porrapp.scoring.ScorerNameMatcher.Resolution;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Emparejamiento del pichichi escrito a mano con jugadores reales, tal como los nombra el proveedor. */
class ScorerNameMatcherTest {

    private static final Player MBAPPE = player("1", "Kylian Mbappé", "K. Mbappé");
    private static final Player LEWANDOWSKI = player("2", "Robert Lewandowski", "R. Lewandowski");
    private static final Player VINICIUS = player("3", "Vinícius Júnior", "V. Júnior");
    private static final Player YAMAL = player("4", "Lamine Yamal", "L. Yamal");
    private static final Player GRIEZMANN = player("5", "Antoine Griezmann", "A. Griezmann");
    private static final Player SORLOTH = player("6", "Alexander Sørloth", "A. Sørloth");
    private static final Player INAKI = player("7", "Iñaki Williams", "I. Williams");
    private static final Player NICO = player("8", "Nico Williams", "N. Williams");
    private static final Player OYARZABAL = player("9", "Mikel Oyarzabal", "M. Oyarzabal");
    private static final Player ALVAREZ = player("10", "Julián Álvarez", "J. Álvarez");
    private static final Player GONCALO = player("11", "Gonçalo Ramos", "G. Ramos");
    private static final Player SERGIO = player("12", "Sergio Ramos", "S. Ramos");
    private static final Player LAUTARO = player("13", "Lautaro Martínez", "L. Martínez");
    private static final Player LISANDRO = player("14", "Lisandro Martínez", "L. Martínez");
    private static final Player DE_BRUYNE = player("15", "Kevin De Bruyne", "K. De Bruyne");
    private static final Player MAC_ALLISTER = player("16", "Alexis Mac Allister", "A. Mac Allister");
    private static final Player AUBAMEYANG = player("17", "Pierre-Emerick Aubameyang", "P. Aubameyang");
    private static final Player SON = player("18", "Son Heung-Min", "Son Heung-Min");
    private static final Player OLMO = player("19", "Dani Olmo", "D. Olmo");
    private static final Player FERRAN = player("20", "Ferran Torres", "F. Torres");
    private static final Player PAU = player("21", "Pau Torres", "P. Torres");
    private static final Player RAPHINHA = player("22", "Raphinha", "Raphinha");
    private static final Player KANE = player("23", "Harry Kane", "H. Kane");
    private static final Player KANTE = player("24", "N'Golo Kanté", "N. Kanté");
    private static final Player EN_NESYRI = player("25", "Youssef En-Nesyri", "Y. En-Nesyri");

    private static final List<Player> PLAYERS = List.of(MBAPPE, LEWANDOWSKI, VINICIUS, YAMAL, GRIEZMANN, SORLOTH,
            INAKI, NICO, OYARZABAL, ALVAREZ, GONCALO, SERGIO, LAUTARO, LISANDRO, DE_BRUYNE, MAC_ALLISTER, AUBAMEYANG,
            SON, OLMO, FERRAN, PAU, RAPHINHA, KANE, KANTE, EN_NESYRI);

    private static Player player(String id, String name, String shortName) {
        return new Player(id, name, shortName);
    }

    private static Player byId(String id) {
        return PLAYERS.stream().filter(player -> player.id().equals(id)).findFirst().orElseThrow();
    }

    @ParameterizedTest(name = "«{0}» es el jugador {1}")
    @DisplayName("Tildes, mayúsculas, apellido solo, inicial y erratas de una letra dan con el jugador")
    @CsvSource(delimiter = '|', value = {
            // tildes y mayúsculas
            "Kylian Mbappé | 1", "kylian mbappe | 1", "MBAPPE | 1", "  Mbappé  | 1", "Mbappè | 1",
            "Julian Alvarez | 10", "ÁLVAREZ | 10", "Inaki Williams | 7", "Iñaki Williams | 7",
            "Sorloth | 6", "Sørloth | 6", "Goncalo Ramos | 11", "Gonçalo Ramos | 11", "Kante | 24", "Kanté | 24",
            // nombre corto e inicial
            "K. Mbappé | 1", "K Mbappe | 1", "k.mbappe | 1", "N. Williams | 8", "I. Williams | 7",
            "G. Ramos | 11", "S. Ramos | 12", "V. Junior | 3",
            // solo el apellido
            "Lewandowski | 2", "Yamal | 4", "Griezmann | 5", "Oyarzabal | 9", "Aubameyang | 17", "Olmo | 19",
            "Raphinha | 22",
            // una letra de menos o de más
            "Mbape | 1", "Mbapppe | 1", "Lewandoski | 2", "Lewandowsky | 2", "Griezman | 5", "Oiarzabal | 9",
            "Álvares | 10", "Rapinha | 22", "Aubameyan | 17", "Yamall | 4",
            // inicial y apellido con errata
            "K. Mbape | 1", "R. Lewandoski | 2", "A. Griezman | 5",
            // nombre completo con erratas
            "Robert Lewandowsky | 2", "Julian Alvares | 10", "Kilian Mbappe | 1", "Lamin Yamal | 4",
            "Antoine Griezman | 5",
            // «Jr» es «Júnior»
            "Vinicius Jr | 3", "Vinícius Jr. | 3", "Vinicius Junior | 3",
            // apellidos compuestos y con guion o apóstrofo
            "De Bruyne | 15", "Bruyne | 15", "de bruine | 15", "Debruyne | 15", "K. De Bruyne | 15",
            "Mac Allister | 16", "MacAllister | 16", "Macalister | 16", "Allister | 16", "Alexis Mac Allister | 16",
            "En-Nesyri | 25", "En Nesyri | 25", "Ennesyri | 25", "N'Golo Kanté | 24", "NGolo Kante | 24",
            "Pierre Emerick Aubameyang | 17", "Son Heung Min | 18", "Heung-Min | 18",
    })
    void resolvesToThePlayer(String written, String playerId) {
        Resolution resolution = ScorerNameMatcher.resolve(written, PLAYERS);

        assertThat(resolution.doubtful()).as("«%s» se identifica", written).isFalse();
        assertThat(resolution.player()).isEqualTo(byId(playerId));
        assertThat(resolution.candidates()).isEmpty();
        assertThat(ScorerNameMatcher.isSamePlayer(written, byId(playerId), PLAYERS)).isTrue();
    }

    @Test
    @DisplayName("Dos formas de escribir al mismo jugador son el mismo jugador")
    void differentSpellingsAreTheSamePlayer() {
        List<String> spellings = List.of("Lewandowski", "lewandoski", "R. Lewandowski", "ROBERT LEWANDOWSKI",
                "Robert Lewandowsky", "r lewandowsky");

        assertThat(spellings).allSatisfy(written ->
                assertThat(ScorerNameMatcher.resolve(written, PLAYERS).player()).as(written).isEqualTo(LEWANDOWSKI));
    }

    @Test
    @DisplayName("Un apellido que llevan dos jugadores queda dudoso entre los dos, nunca se da uno por bueno")
    void aSharedSurnameIsDoubtfulBetweenThosePlayers() {
        assertThat(candidates("Ramos")).containsExactlyInAnyOrder(GONCALO, SERGIO);
        assertThat(candidates("Williams")).containsExactlyInAnyOrder(INAKI, NICO);
        assertThat(candidates("Torres")).containsExactlyInAnyOrder(FERRAN, PAU);
        assertThat(candidates("Martínez")).containsExactlyInAnyOrder(LAUTARO, LISANDRO);
        // La inicial tampoco los distingue.
        assertThat(candidates("L. Martínez")).containsExactlyInAnyOrder(LAUTARO, LISANDRO);

        assertThat(ScorerNameMatcher.isSamePlayer("Ramos", GONCALO, PLAYERS)).isFalse();
        assertThat(ScorerNameMatcher.isSamePlayer("Sergio Ramos", GONCALO, PLAYERS)).isFalse();
        assertThat(ScorerNameMatcher.resolve("Lautaro Martinez", PLAYERS).player()).isEqualTo(LAUTARO);
        assertThat(ScorerNameMatcher.resolve("Nico Williams", PLAYERS).player()).isEqualTo(NICO);
    }

    @Test
    @DisplayName("El nombre de pila solo no identifica a nadie, pero propone a quienes lo llevan")
    void aFirstNameAloneOnlySuggestsPlayers() {
        assertThat(candidates("Vinicius")).containsExactly(VINICIUS);
        assertThat(candidates("Lamine")).containsExactly(YAMAL);
        assertThat(candidates("Lautaro")).containsExactly(LAUTARO);
        assertThat(candidates("Ferrán")).containsExactly(FERRAN);
        assertThat(candidates("Son")).containsExactly(SON);
    }

    @Test
    @DisplayName("Un apellido corto no admite erratas y demasiadas erratas no encajan con nadie")
    void tooManyTyposMatchNobody() {
        assertThat(nobody("Kanes")).isTrue();
        assertThat(nobody("Olmos")).isTrue();
        assertThat(nobody("Levandoski")).isTrue();
        assertThat(nobody("Grizman")).isTrue();
        assertThat(nobody("Haaland")).isTrue();
        assertThat(nobody("")).isTrue();
        assertThat(nobody("   ")).isTrue();
        assertThat(nobody(null)).isTrue();
        assertThat(nobody("???")).isTrue();
    }

    @Test
    @DisplayName("«Kanté» nunca es Kane; «Kane», que podría ser una errata de Kanté, queda dudoso entre los dos")
    void aSurnameOneLetterAwayFromAnotherIsNeverTakenForIt() {
        assertThat(ScorerNameMatcher.resolve("Kante", PLAYERS).player()).isEqualTo(KANTE);
        assertThat(ScorerNameMatcher.isSamePlayer("Kanté", KANE, PLAYERS)).isFalse();
        assertThat(candidates("Kane")).containsExactlyInAnyOrder(KANE, KANTE);
        assertThat(ScorerNameMatcher.resolve("Harry Kane", PLAYERS).player()).isEqualTo(KANE);
        assertThat(ScorerNameMatcher.resolve("H. Kane", PLAYERS).player()).isEqualTo(KANE);
        // Sin Kanté entre los conocidos no hay duda.
        assertThat(ScorerNameMatcher.resolve("Kane", List.of(KANE, MBAPPE)).player()).isEqualTo(KANE);
    }

    @Test
    @DisplayName("Dos jugadores distintos con el mismo nombre quedan dudosos entre los dos")
    void twoPlayersWithTheSameNameAreDoubtful() {
        Player one = player("100", "Luis Suárez", "L. Suárez");
        Player other = player("200", "Luis Suárez", "L. Suárez");

        Resolution resolution = ScorerNameMatcher.resolve("Luis Suarez", List.of(one, other, MBAPPE));

        assertThat(resolution.doubtful()).isTrue();
        assertThat(resolution.candidates()).containsExactly(one, other);
    }

    @Test
    @DisplayName("Una errata que se parece más a otro jugador no da por bueno al que no es")
    void aTypoCloserToAnotherPlayerIsNotThisOne() {
        Player juarez = player("300", "Luis Juárez", "L. Juárez");
        Player suarez = player("301", "Luis Suárez", "L. Suárez");

        assertThat(ScorerNameMatcher.isSamePlayer("Luis Suares", juarez, List.of(juarez, suarez))).isFalse();
        assertThat(ScorerNameMatcher.isSamePlayer("Luis Suares", suarez, List.of(juarez, suarez))).isTrue();
    }

    @Test
    @DisplayName("Sin lista de jugadores no hay con quién emparejar")
    void withoutPlayersNothingMatches() {
        assertThat(ScorerNameMatcher.resolve("Mbappé", List.of()).doubtful()).isTrue();
        assertThat(ScorerNameMatcher.resolve("Mbappé", null).candidates()).isEmpty();
    }

    @ParameterizedTest(name = "«{0}» se normaliza como «{1}»")
    @CsvSource(delimiter = '|', value = {
            "Kylian  MBAPPÉ | kylian mbappe", "Vinícius Jr. | vinicius junior", "N'Golo Kanté | ngolo kante",
            "Alexander Sørloth | alexander sorloth", "Marc-André ter Stegen | marc andre ter stegen",
            "Łukasz Piszczek | lukasz piszczek", "Luka Modrić | luka modric", "İlkay Gündoğan | ilkay gundogan",
    })
    void normalizes(String written, String expected) {
        assertThat(ScorerNameMatcher.normalize(written)).isEqualTo(expected);
    }

    private static List<Player> candidates(String written) {
        Resolution resolution = ScorerNameMatcher.resolve(written, PLAYERS);
        assertThat(resolution.doubtful()).as("«%s» queda dudoso", written).isTrue();
        return resolution.candidates();
    }

    private static boolean nobody(String written) {
        Resolution resolution = ScorerNameMatcher.resolve(written, PLAYERS);
        return resolution.doubtful() && resolution.candidates().isEmpty();
    }
}
