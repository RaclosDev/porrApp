package app.porrapp.service.formulaone;

import app.porrapp.dto.RaceClassificationDTO;
import app.porrapp.model.Match;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.RaceDriver;
import app.porrapp.model.RaceWeekend;
import app.porrapp.repository.RaceDriverRepository;
import app.porrapp.repository.RaceWeekendRepository;
import app.porrapp.sports.EspnFormulaOneClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RaceClassificationServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final EspnFormulaOneClient espn = mock(EspnFormulaOneClient.class);
    private final RaceWeekendRepository weekends = mock(RaceWeekendRepository.class);
    private final RaceDriverRepository drivers = mock(RaceDriverRepository.class);
    private final RaceClassificationService service = new RaceClassificationService(espn, weekends, drivers, mapper);

    private final Match mexico = Match.builder().id(125L).externalId("f1:600057447").round("GP de México")
            .status(MatchStatusNormalized.FINISHED).build();
    private RaceWeekend weekend;

    private JsonNode json(String text) {
        return mapper.readTree(text.replace('\'', '"'));
    }

    private JsonNode stats(String stats) {
        return json("[{'stats':[" + stats + "]}]");
    }

    @BeforeEach
    void setUp() throws Exception {
        weekend = RaceWeekend.builder().matchId(125L).raceSessionId("401839127").build();
        when(weekends.findById(125L)).thenReturn(Optional.of(weekend));
        when(weekends.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(espn.sessionCompetitors("600057447", "401839127")).thenReturn(json("""
                [{'id':'4665','order':1,'startOrder':5,'vehicle':{'manufacturer':'Red Bull','teamColor':'00327d','number':'3'}},
                 {'id':'868','order':2,'startOrder':1,'vehicle':{'manufacturer':'Ferrari','teamColor':'DC0000','number':'44'}},
                 {'id':'4520','order':20,'startOrder':21,'vehicle':{'manufacturer':'Cadillac'}},
                 {'id':'348','order':22,'startOrder':17,'vehicle':{'manufacturer':'Aston Martin'}}]"""));
        when(espn.competitorStatistics("600057447", "401839127", "4665")).thenReturn(stats(
                "{'name':'lapsCompleted','value':71,'displayValue':'71'},{'name':'totalTime','displayValue':'2:20:28.772'},"
                        + "{'name':'championshipPts','value':25,'displayValue':'25'}"));
        when(espn.competitorStatistics("600057447", "401839127", "868")).thenReturn(stats(
                "{'name':'lapsCompleted','value':71},{'name':'behindTime','displayValue':'+0.799'},"
                        + "{'name':'championshipPts','value':18},{'name':'fastestLap','displayValue':'1:19.268'}"));
        when(espn.competitorStatistics("600057447", "401839127", "4520")).thenReturn(stats(
                "{'name':'lapsCompleted','value':70},{'name':'behindLaps','value':1,'displayValue':'1'},"
                        + "{'name':'behindTime','displayValue':'+1 lap'},{'name':'championshipPts','value':0}"));
        when(espn.competitorStatistics("600057447", "401839127", "348")).thenReturn(stats(
                "{'name':'lapsCompleted','value':5},{'name':'behindLaps','value':66},{'name':'championshipPts','value':0}"));
        for (String id : List.of("4665", "868", "4520")) {
            when(espn.competitorStatus("600057447", "401839127", id)).thenReturn(json("{'type':{'name':'STATUS_CLASSIFIED'}}"));
        }
        when(espn.competitorStatus("600057447", "401839127", "348")).thenReturn(json("{'type':{'name':'STATUS_RETIRED'}}"));
        when(drivers.findByExternalIdIn(anyCollection())).thenReturn(List.of(
                RaceDriver.builder().id(6L).externalId("4665").name("Max Verstappen").teamName("Red Bull").build(),
                RaceDriver.builder().id(4L).externalId("868").name("Lewis Hamilton").teamName("Ferrari").build(),
                RaceDriver.builder().id(9L).externalId("348").name("Fernando Alonso").teamName("Aston Martin").build()));
    }

    @Test
    void cargaLaClasificacionDeEspnLaGuardaYDaTiemposDiferenciasYAbandonos() {
        RaceClassificationDTO result = service.classification(mexico);

        assertThat(result.available()).isTrue();
        assertThat(result.rows()).extracting(RaceClassificationDTO.Row::position).containsExactly(1, 2, 20, 22);
        RaceClassificationDTO.Row winner = result.rows().get(0);
        assertThat(winner.name()).isEqualTo("Max Verstappen");
        assertThat(winner.time()).isEqualTo("2:20:28.772");
        assertThat(winner.gap()).isNull();
        assertThat(winner.grid()).isEqualTo(5);
        assertThat(winner.points()).isEqualTo(25);
        assertThat(winner.teamColor()).isEqualTo("00327D");
        assertThat(winner.number()).isEqualTo("3");

        RaceClassificationDTO.Row second = result.rows().get(1);
        assertThat(second.gap()).isEqualTo("+0.799");
        assertThat(second.fastestLap()).isTrue();
        assertThat(second.driverId()).isEqualTo(4L);

        RaceClassificationDTO.Row lapped = result.rows().get(2);
        assertThat(lapped.name()).isEqualTo("Piloto");
        assertThat(lapped.team()).isEqualTo("Cadillac");
        assertThat(lapped.gap()).isNull();
        assertThat(lapped.lapsBehind()).isEqualTo(1);
        assertThat(lapped.status()).isEqualTo("FINISHED");

        RaceClassificationDTO.Row retired = result.rows().get(3);
        assertThat(retired.status()).isEqualTo("RETIRED");
        assertThat(retired.laps()).isEqualTo(5);
        assertThat(retired.lapsBehind()).isNull();
        assertThat(retired.gap()).isNull();

        assertThat(weekend.getClassification()).contains("\"athleteId\":\"4665\"");
        verify(weekends).save(weekend);
    }

    @Test
    void unaVezGuardadaNoVuelveAPreguntarAEspn() throws Exception {
        service.classification(mexico);
        service.classification(mexico);
        verify(espn, org.mockito.Mockito.times(1)).sessionCompetitors(anyString(), anyString());
    }

    @Test
    void siFaltaUnPilotoNoGuardaNadaYLoReintentaLuego() throws Exception {
        when(espn.competitorStatus("600057447", "401839127", "348")).thenThrow(new java.io.IOException("503"));

        RaceClassificationDTO result = service.classification(mexico);

        assertThat(result.available()).isFalse();
        assertThat(weekend.getClassification()).isNull();
        verify(weekends, never()).save(any());
    }

    @Test
    void unaCarreraSinAcabarNoSePide() throws Exception {
        mexico.setStatus(MatchStatusNormalized.LIVE);
        assertThat(service.classification(mexico)).isEqualTo(RaceClassificationDTO.NONE);
        verify(espn, never()).sessionCompetitors(anyString(), eq("401839127"));
    }

    @Test
    void reduceLosEstadosDeEspn() {
        assertThat(RaceClassificationService.status("STATUS_CLASSIFIED")).isEqualTo("FINISHED");
        assertThat(RaceClassificationService.status("STATUS_RETIRED")).isEqualTo("RETIRED");
        assertThat(RaceClassificationService.status("STATUS_DISQUALIFIED")).isEqualTo("DISQUALIFIED");
        assertThat(RaceClassificationService.status("STATUS_DID_NOT_START")).isEqualTo("DID_NOT_START");
        assertThat(RaceClassificationService.status(null)).isEqualTo("OTHER");
    }

    @Test
    void sinPilotosNiVehiculoLaFilaQuedaSinEscuderia() {
        RaceClassificationService.Stored row = RaceClassificationService.toRow(
                json("{'id':'1','order':3}"), Map.of(), "FINISHED");
        assertThat(row.team()).isNull();
        assertThat(row.grid()).isNull();
        assertThat(row.gap()).isNull();
    }
}
