package com.porra.mundial.service.formulaone;

import com.porra.mundial.dto.FormulaOneStandingsDTO;
import com.porra.mundial.model.RaceDriver;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class FormulaOneStandingsServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private JsonNode json(String text) {
        return mapper.readTree(text.replace('\'', '"'));
    }

    @Test
    void leeElMundialDePilotosYConstructoresConLaEscuderiaDeCadaPiloto() {
        JsonNode drivers = json("""
                {'season':'2026','entries':[
                  {'athlete':{'id':'5829','displayName':'Kimi Antonelli','shortName':'K. Antonelli','abbreviation':'ANT',
                    'flag':{'href':'https://a.espncdn.com/ita.png','alt':'Italy'}},
                   'stats':[{'name':'rank','value':1.0},{'name':'championshipPts','value':380.0},
                            {'name':'AUS','id':'600057427','value':18.0}]},
                  {'athlete':{'id':'4665','displayName':'Max Verstappen','flag':{'href':'http://inseguro/ned.png','alt':'Netherlands'}},
                   'stats':[{'name':'rank','value':2.0},{'name':'championshipPts','value':261.0}]},
                  {'athlete':{},'stats':[]}
                ]}""");
        JsonNode constructors = json("""
                {'season':'2026','entries':[
                  {'team':{'displayName':'Mercedes','color':'00d2be'},'stats':[{'name':'rank','value':1.0},{'name':'points','value':630.0}]},
                  {'team':{'displayName':'Ferrari','color':'rojo'},'stats':[{'name':'rank','value':2.0},{'name':'points','value':504.0}]}
                ]}""");
        RaceDriver kimi = RaceDriver.builder().externalId("5829").teamName("Mercedes").teamColor("00D2BE").build();

        FormulaOneStandingsDTO result = FormulaOneStandingsService.parse(drivers, constructors, Map.of("5829", kimi));

        assertThat(result.season()).isEqualTo("2026");
        assertThat(result.drivers()).hasSize(2);
        FormulaOneStandingsDTO.DriverRow first = result.drivers().get(0);
        assertThat(first.rank()).isEqualTo(1);
        assertThat(first.points()).isEqualTo(380);
        assertThat(first.team()).isEqualTo("Mercedes");
        assertThat(first.country()).isEqualTo("Italia");
        FormulaOneStandingsDTO.DriverRow second = result.drivers().get(1);
        assertThat(second.team()).isNull();
        assertThat(second.flagUrl()).isNull();
        assertThat(second.country()).isEqualTo("Países Bajos");
        assertThat(result.constructors()).extracting(FormulaOneStandingsDTO.ConstructorRow::name)
                .containsExactly("Mercedes", "Ferrari");
        assertThat(result.constructors().get(0).color()).isEqualTo("00D2BE");
        assertThat(result.constructors().get(1).color()).isNull();
        assertThat(result.constructors().get(1).points()).isEqualTo(504);
    }

    @Test
    void sinTablasDevuelveListasVacias() {
        FormulaOneStandingsDTO result = FormulaOneStandingsService.parse(null, null, Map.of());
        assertThat(result.drivers()).isEmpty();
        assertThat(result.constructors()).isEmpty();
        assertThat(result.season()).isNull();
    }
}
