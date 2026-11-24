package app.porrapp.service.demo;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class DemoAnonymizerTest {

    private final ObjectMapper mapper = JsonMapper.builder().build();

    @Test
    void cambiaNombresLigasYQuitaDatosPersonales() {
        JsonNode league = mapper.readTree("""
                {"id":6,"name":"Liga de los Pérez","joinCode":"XK2P9","adminUserId":1,
                 "adminParticipantName":"Ramón Pérez","imageUrl":"/x.png"}""");
        JsonNode board = mapper.readTree("""
                [{"userId":1,"participantName":"Ramón Pérez","email":"r@x.es","avatarUrl":"/a.png"},
                 {"userId":99,"participantName":"Lucas Gil","predictionName":"Real Madrid"}]""");
        JsonNode log = mapper.readTree("""
                ["Ramón Pérez acierta el 2-1", "Lucas Gil entra en la Liga de los Pérez"]""");
        List<JsonNode> nodes = new ArrayList<>(List.of(league, board, log));

        new DemoAnonymizer(Map.of(6L, "LaLiga de la oficina")).anonymize(nodes);

        String all = nodes.toString();
        assertThat(all).doesNotContain("Ramón", "Pérez", "Lucas", "Gil", "XK2P9", "r@x.es", "/a.png", "/x.png");
        assertThat(league.path("name").asString()).isEqualTo("LaLiga de la oficina");
        assertThat(league.path("joinCode").asString()).isEqualTo(DemoAnonymizer.JOIN_CODE);
        assertThat(league.path("adminParticipantName").asString()).isEqualTo("Dani");
        assertThat(board.get(0).path("participantName").asString()).isEqualTo("Dani");
        assertThat(board.get(0).has("email")).isFalse();
        assertThat(board.get(1).path("participantName").asString()).isEqualTo("Lucía");
        assertThat(board.get(1).path("predictionName").asString()).isEqualTo("Lucía");
        assertThat(log.get(0).asString()).isEqualTo("Dani acierta el 2-1");
        assertThat(log.get(1).asString()).isEqualTo("Lucía entra en la LaLiga de la oficina");
    }

    @Test
    void losIdsDeUsuarioSonPropiosDeLaDemo() {
        JsonNode league = mapper.readTree("""
                {"id":6,"name":"Liga","joinCode":"XK2P9","adminUserId":7,"adminUserIds":[7,501],"organizerUserIds":[501]}""");
        JsonNode members = mapper.readTree("""
                [{"userId":7,"participantName":"Marta Real"},{"userId":501,"participantName":"Dummy Real"}]""");
        JsonNode me = mapper.readTree("""
                {"userId":7,"participantName":"Marta Real"}""");
        List<JsonNode> nodes = new ArrayList<>(List.of(league, members, me));

        new DemoAnonymizer(Map.of(6L, "Liga demo")).anonymize(nodes);

        // Marta es la quinta conocida: siempre 105, como su retrato en la app.
        long marta = DemoAnonymizer.FIRST_KNOWN_ID + 4;
        assertThat(members.get(0).path("userId").asLong()).isEqualTo(marta);
        assertThat(me.path("userId").asLong()).isEqualTo(marta);
        assertThat(league.path("adminUserId").asLong()).isEqualTo(marta);
        long other = members.get(1).path("userId").asLong();
        assertThat(other).isGreaterThanOrEqualTo(DemoAnonymizer.FIRST_SPARE_ID);
        assertThat(league.path("adminUserIds").get(1).asLong()).isEqualTo(other);
        assertThat(league.path("organizerUserIds").get(0).asLong()).isEqualTo(other);
        assertThat(nodes.toString()).doesNotContain("501", "Real");
    }

    @Test
    void codificaLaJornadaComoElNavegador() {
        assertThat(DemoSnapshotService.encode("Jornada 13 (aplazada)")).isEqualTo("Jornada%2013%20(aplazada)");
    }
}
