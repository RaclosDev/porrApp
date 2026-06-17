package com.porra.mundial.controller;

import com.porra.mundial.service.MatchService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MatchController.class)
class MatchControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MatchService matchService;

    @Test
    void getLiveMatches_ReturnsList() throws Exception {
        Map<String, Object> matchDto = new HashMap<>();
        matchDto.put("id", 100);
        matchDto.put("home", "España");
        matchDto.put("away", "Francia");
        matchDto.put("isStartingSoon", true);

        // matchService.getLiveMatches() returns List<Match>, but wait!
        // MatchController calls matchService.getLiveMatches().stream().map(matchService::toMatchDto)...
        // This means the controller invokes toMatchDto. We need to mock getLiveMatches AND toMatchDto, or...
        // Actually, since MatchController uses map(matchService::toMatchDto), the mock of matchService.toMatchDto
        // will return null if we don't configure it. We need to mock BOTH.
        
        com.porra.mundial.model.Match matchEntity = com.porra.mundial.model.Match.builder().id(100L).build();
        
        Mockito.when(matchService.getLiveMatches()).thenReturn(List.of(matchEntity));
        Mockito.when(matchService.toMatchDto(matchEntity)).thenReturn(matchDto);

        mockMvc.perform(get("/api/matches/live"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(100))
                .andExpect(jsonPath("$[0].home").value("España"));
    }

    @Test
    void getRadarMatches_ReturnsRadarMap() throws Exception {
        Map<String, Object> radarMap = new HashMap<>();
        radarMap.put("live", List.of());
        radarMap.put("last", List.of());
        radarMap.put("next", List.of());

        // We can't easily test radar without mocking the internal logic or we test the contract.
        // The MatchController implements /radar using matchService internally.
        // Actually, radar calls matchService.getLiveMatches(), getLastMatches(5), getNextMatches(10).
        Mockito.when(matchService.getLiveMatches()).thenReturn(List.of());
        Mockito.when(matchService.getLastMatches(5)).thenReturn(List.of());
        Mockito.when(matchService.getNextMatches(10)).thenReturn(List.of());

        mockMvc.perform(get("/api/matches/radar"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.live").isArray());
    }
}
