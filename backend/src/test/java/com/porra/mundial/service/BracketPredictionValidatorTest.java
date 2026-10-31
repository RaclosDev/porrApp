package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.model.*;
import com.porra.mundial.repository.TeamRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class BracketPredictionValidatorTest {
    private final TeamRepository repository = mock(TeamRepository.class);
    private final BracketPredictionValidator validator = new BracketPredictionValidator(repository);
    private final Edition edition = Edition.builder().poolFormat(PoolFormat.KNOCKOUTS_ONLY)
            .competition(Competition.builder().externalId(Competition.WORLD_CUP_EXTERNAL_ID).build()).build();

    @BeforeEach
    void loadWorldCupTeams() {
        List<Team> teams = new ArrayList<>();
        for (char group = 'A'; group <= 'L'; group++) {
            for (int number = 1; number <= 4; number++) {
                teams.add(Team.builder().name(group + "" + number)
                        .groupName(String.valueOf(group)).build());
            }
        }
        when(repository.findAllByOrderByGroupNameAscNameAsc()).thenReturn(teams);
    }

    private PredictionDataDTO draft() {
        PredictionDataDTO data = new PredictionDataDTO();
        data.setGroups(Map.of());
        data.setR32(List.of(List.of("A1", "A2"), List.of("B1", "B2")));
        data.setR16(List.of(List.of("A1", "B1")));
        data.setQf(List.of(List.of("A1", "B1")));
        data.setSf(List.of(List.of("A1", "B1")));
        data.setFinalMatch(List.of("A1", "B1"));
        data.setChampion("A1");
        return data;
    }

    @Test
    void acceptsKnockoutDraftWithoutGroupsAndWithNullSlots() {
        var data = draft();
        data.setFinalMatch(Arrays.asList("A1", null));
        data.setChampion(null);

        assertDoesNotThrow(() -> validator.validate(edition, data));
    }

    @Test
    void acceptsFrontendGroupsAndLegacyFourthTeam() {
        var data = draft();
        edition.setPoolFormat(PoolFormat.FULL_BRACKET);
        Map<String, List<String>> groups = new LinkedHashMap<>();
        for (char group = 'A'; group <= 'L'; group++) {
            groups.put(String.valueOf(group), List.of(group + "1", group + "2", group + "3", group + "4"));
        }
        data.setGroups(groups);

        assertDoesNotThrow(() -> validator.validate(edition, data));
        groups.put("A", List.of("A1", "A2", "A3"));

        assertDoesNotThrow(() -> validator.validate(edition, data));
    }

    @Test
    void acceptsPartialGroupDraftWithoutKnockoutSelections() {
        edition.setPoolFormat(PoolFormat.FULL_BRACKET);
        var data = new PredictionDataDTO();
        data.setGroups(Map.of("A", List.of("A1", "A2")));


        assertDoesNotThrow(() -> validator.validate(edition, data));
    }

    @Test
    void rejectsDuplicateTeams() {
        var data = draft();
        data.setR16(List.of(List.of("A1", "A1")));

        assertThrows(IllegalArgumentException.class, () -> validator.validate(edition, data));
    }

    @Test
    void rejectsOversizedRounds() {
        var data = draft();
        data.setR16(Collections.nCopies(50, List.of("A1", "B1")));

        assertThrows(IllegalArgumentException.class, () -> validator.validate(edition, data));
    }

    @Test
    void rejectsUnknownTeams() {
        final var data = draft();
        data.setR32(List.of(List.of("Unknown", "A1")));

        assertThrows(IllegalArgumentException.class, () -> validator.validate(edition, data));
    }

    @Test
    void rejectsChampionOutsideTheFinal() {
        var invalid = draft();
        invalid.setChampion("A2");

        assertThrows(IllegalArgumentException.class, () -> validator.validate(edition, invalid));
    }

    @Test
    void rejectsMalformedPairs() {
        var data = draft();
        data.setQf(Arrays.asList((List<String>)null));

        assertThrows(IllegalArgumentException.class, () -> validator.validate(edition, data));
    }

    @Test
    void rejectsFinalistInThirdPlaceMatch() {
        var data = draft();
        data.setThirdPlaceMatch(List.of("A1", "B1"));

        assertThrows(IllegalArgumentException.class, () -> validator.validate(edition, data));
    }

    @Test
    void rejectsGroupsForKnockouts() {
        var data = draft();
        data.setGroups(Map.of("A", List.of("A1", "A2")));

        assertThrows(IllegalArgumentException.class, () -> validator.validate(edition, data));
    }

    @Test
    void rejectsUnsupportedCompetition() {
        var data = draft();
        edition.getCompetition().setExternalId("esp.1");

        assertThrows(IllegalArgumentException.class, () -> validator.validate(edition, data));
    }

    @Test
    void rejectsRoundOf32WithoutGroupQualifiers() {
        var data = draft();
        edition.setPoolFormat(PoolFormat.FULL_BRACKET);

        assertThrows(IllegalArgumentException.class, () -> validator.validate(edition, data));
    }

    @Test
    void rejectsUnselectedThirdQualifier() {
        var data = draft();
        edition.setPoolFormat(PoolFormat.FULL_BRACKET);
        Map<String, List<String>> groups = new HashMap<>();
        for (char group = 'A'; group <= 'L'; group++) {
            groups.put(String.valueOf(group), List.of(group + "1", group + "2", group + "3"));
        }
        data.setGroups(groups);
        data.setR32(List.of(List.of("A1", "A3")));

        assertThrows(IllegalArgumentException.class, () -> validator.validate(edition, data));
    }
}
