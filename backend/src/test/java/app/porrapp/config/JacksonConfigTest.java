package app.porrapp.config;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class JacksonConfigTest {

    private final JsonMapper mapper = JsonMapper.builder().addModule(JacksonConfig.madridOffsetDates()).build();

    @Test
    void summerDatesCarryTheMadridSummerOffset() {
        String json = mapper.writeValueAsString(Map.of("date", LocalDateTime.of(2026, 6, 11, 21, 0)));

        assertThat(json).isEqualTo("{\"date\":\"2026-06-11T21:00:00+02:00\"}");
    }

    @Test
    void winterDatesCarryTheMadridWinterOffset() {
        String json = mapper.writeValueAsString(Map.of("date", LocalDateTime.of(2026, 12, 5, 18, 30, 15)));

        assertThat(json).isEqualTo("{\"date\":\"2026-12-05T18:30:15+01:00\"}");
    }
}
