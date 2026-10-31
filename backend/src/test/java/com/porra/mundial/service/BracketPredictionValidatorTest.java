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
    void legacyKeepsHistoricalBranchesButVersionTwoRejectsTwoWinnersFromOneMatch() {
        var data = draft();
        assertDoesNotThrow(() -> validator.validate(edition, data));
        data.setTopologyVersion(1);
        assertDoesNotThrow(() -> validator.validate(edition, data));
        data.setTopologyVersion(2);
        assertThrows(IllegalArgumentException.class, () -> validator.validate(edition, data));
    }

    @Test
    void versionTwoAcceptsPartialSlotsAndRejectsCrossBranchAdvancement() {
        var data = new PredictionDataDTO();
        data.setTopologyVersion(2);
        data.setR32(List.of(List.of("A1", "A2"), List.of("B1", "B2"), List.of("C1", "C2"), List.of("D1", "D2")));
        data.setR16(List.of(List.of("A1", "B1"), List.of("C1", "D1")));
        data.setQf(List.of(Arrays.asList("A1", null)));
        assertDoesNotThrow(() -> validator.validate(edition, data));
        data.setQf(List.of(Arrays.asList(null, "A1")));
        assertThrows(IllegalArgumentException.class, () -> validator.validate(edition, data));
    }

    @Test
    void versionTwoFinalistsAndThirdsMustComeFromTheirOwnSemifinal() {
        var data = new PredictionDataDTO();
        data.setTopologyVersion(2);
        var round = new ArrayList<List<String>>();
        for (char g = 'A'; g <= 'H'; g++) {
            round.add(List.of(g + "1", g + "2"));
            round.add(List.of(g + "3", g + "4"));
        }
        data.setR32(round);
        data.setR16(next(round));
        data.setQf(next(data.getR16()));
        data.setSf(next(data.getQf()));
        data.setFinalMatch(List.of("A1", "E1"));
        data.setThirdPlaceMatch(List.of("C1", "G1"));
        data.setChampion("A1");
        data.setThirdPlaceWinner("G1");
        assertDoesNotThrow(() -> validator.validate(edition, data));
        data.setFinalMatch(List.of("E1", "A1"));
        assertThrows(IllegalArgumentException.class, () -> validator.validate(edition, data));
        data.setFinalMatch(List.of("A1", "E1"));
        data.setThirdPlaceMatch(List.of("G1", "C1"));
        assertThrows(IllegalArgumentException.class, () -> validator.validate(edition, data));
    }

    private List<List<String>> next(List<List<String>> source) {
        var next = new ArrayList<List<String>>();
        for (int i = 0; i < source.size(); i += 2) next.add(List.of(source.get(i).get(0), source.get(i + 1).get(0)));
        return next;
    }

    @Test
    void rejectsUnsupportedTopologyVersion() {
        var data = draft();
        data.setTopologyVersion(3);
        assertThrows(IllegalArgumentException.class, () -> validator.validate(edition, data));
    }

    @Test
    void canonicalFullBracketRequiresTheFifaGroupPositionForEverySlot() {
        edition.setPoolFormat(PoolFormat.FULL_BRACKET);
        var data = new PredictionDataDTO();
        data.setTopologyVersion(2);
        Map<String, List<String>> groups = new HashMap<>();
        for (char g = 'A'; g <= 'L'; g++) groups.put(String.valueOf(g), List.of(g + "1", g + "2", g + "3"));
        data.setGroups(groups);
        data.setThirds(List.of("A3"));
        data.setR32(List.of(List.of("E1", "A3")));
        assertDoesNotThrow(() -> validator.validate(edition, data));
        data.setR32(List.of(List.of("I1", "A3")));
        assertThrows(IllegalArgumentException.class, () -> validator.validate(edition, data));
        data.setThirds(List.of("L3"));
        data.setR32(List.of(List.of("E1", "L3")));
        assertThrows(IllegalArgumentException.class, () -> validator.validate(edition, data));
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
