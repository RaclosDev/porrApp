package com.porra.mundial.dto;

import com.porra.mundial.model.Match;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MatchDatesJsonTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @ParameterizedTest
    @CsvSource({"2026-07-01T21:00:00,+02:00", "2026-12-01T21:00:00,+01:00"})
    void exposesMadridOffsetsAcrossMatchResponses(String date, String offset) {
        LocalDateTime local = LocalDateTime.parse(date);
        var values = List.of(
                mapper.valueToTree(MatchResponseDTO.fromEntity(Match.builder().matchDate(local).build())).path("date"),
                mapper.valueToTree(MatchdayFixturePredictionDTO.builder().matchDate(local).build()).path("matchDate"),
                mapper.valueToTree(MatchdayPointsDTO.builder().date(local).build()).path("date"),
                mapper.valueToTree(GroupResponseDTO.builder().lockDate(local).build()).path("lockDate"),
                mapper.valueToTree(new MatchdayStatsDTO.MatchStats(1L, "1", local, "A", "B", null, null,
                        false, false, null, null, 0, 0, 0, 0, List.of(), null, null)).path("matchDate"));
        for (var value : values) {
            OffsetDateTime parsed = OffsetDateTime.parse(value.asString());
            assertEquals(offset, parsed.getOffset().toString());
            assertEquals(local.atZone(ZoneId.of("Europe/Madrid")).toInstant(), parsed.toInstant());
        }
    }
}
