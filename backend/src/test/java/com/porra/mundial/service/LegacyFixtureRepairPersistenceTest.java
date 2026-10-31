package com.porra.mundial.service;

import com.porra.mundial.model.*;
import com.porra.mundial.repository.*;
import com.porra.mundial.sports.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.Instant;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@Import({LegacyFixtureRepairService.class, MatchEventProcessor.class})
class LegacyFixtureRepairPersistenceTest {
    @Container @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    @Autowired LegacyFixtureRepairService repair;
    @Autowired MatchRepository matches;
    @Autowired TeamRepository teams;
    @Autowired UserAccountRepository users;
    @Autowired LeagueRepository leagues;
    @Autowired EditionRepository editions;
    @Autowired PredictionRepository predictions;
    @Autowired MatchPredictionRepository matchPredictions;
    @MockitoBean SportsDataProviderRegistry providers;
    @MockitoBean MatchPredictionService matchPredictionService;
    @MockitoBean ScoreInvalidationService scores;
    @MockitoBean WebSocketService updates;

    @Test
    void repairsOfficialEventInPlaceWithoutHoldingATransactionDuringHttp() throws Exception {
        Match original = matches.findByExternalId("401882926").orElseThrow();
        Long originalId = original.getId();
        Long placeholderId = original.getHomeTeam().getId();
        assertThat(original.getHomeTeam().getName()).startsWith("Equipo LaLiga ");
        UserAccount user = users.save(UserAccount.builder().googleEmail("repair@test.invalid")
                .googleName("Repair").participantName("Repair").build());
        League league = leagues.save(League.builder().name("Repair League").joinCode("REPAIRTEST").adminUser(user).build());
        Edition edition = editions.save(Edition.builder().league(league).competition(original.getCompetition())
                .poolFormat(PoolFormat.MATCH_DAY).build());
        Prediction prediction = predictions.save(Prediction.builder().user(user).edition(edition).name("Repair").build());
        MatchPrediction selection = matchPredictions.save(MatchPrediction.builder().prediction(prediction)
                .match(original).homeScore(3).awayScore(0).predictionSign("1").build());
        var mapper = new ObjectMapper();
        tools.jackson.databind.node.ObjectNode event;
        // Fuente: ESPN summary?event=401882926 (esp.1), consultado el 31-10-2026.
        try (var stream = getClass().getResourceAsStream("/espn/summary-401882926.json")) {
            event = (tools.jackson.databind.node.ObjectNode) mapper.readTree(stream).path("header").deepCopy();
        }
        event.put("date", event.path("competitions").get(0).path("date").asText());
        SportsDataProvider provider = mock(SportsDataProvider.class);
        when(providers.getProviderForCompetition("esp.1")).thenReturn(provider);
        when(provider.isAvailable()).thenReturn(true);
        when(provider.fetchEvent(anyString(), anyString())).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            if ("401882926".equals(invocation.getArgument(1))) return event;
            throw new IOException("El fixture solo contiene el evento verificado");
        });
        Instant now = Instant.parse("2026-10-31T12:00:00Z");

        var result = repair.repairBatch(now);

        assertThat(result.repaired()).isEqualTo(1);
        Match fixed = matches.findByExternalId("401882926").orElseThrow();
        assertThat(fixed.getId()).isEqualTo(originalId);
        assertThat(fixed.getHomeTeam().getExternalId()).isEqualTo("96");
        assertThat(fixed.getAwayTeam().getExternalId()).isEqualTo("2922");
        assertThat(fixed.getHomeScore()).isEqualTo(3);
        assertThat(fixed.getAwayScore()).isZero();
        assertThat(teams.findById(placeholderId).orElseThrow().getName()).startsWith("Equipo LaLiga ");
        assertThat(matchPredictions.findById(selection.getId()).orElseThrow().getMatch().getId()).isEqualTo(originalId);

        repair.repairBatch(now.plusSeconds(60));

        verify(provider, times(1)).fetchEvent("esp.1", "401882926");
        assertThat(matches.findByExternalId("401882926").orElseThrow().getId()).isEqualTo(originalId);
        assertThat(predictions.findById(prediction.getId())).isPresent();
    }
}
