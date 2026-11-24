package app.porrapp.dto;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ParticipantScoreDTOTest {

    @Test
    void theLeaderboardRowDoesNotCarryTheThirdPlacePicks() {
        ParticipantScoreDTO full = ParticipantScoreDTO.builder()
                .name("Ana")
                .total(42)
                .thirdPlaceMatch(List.of("Francia", "Brasil"))
                .thirdPlaceWinner("Francia")
                .build();

        ParticipantScoreDTO row = full.withoutBreakdown();

        assertThat(row.getThirdPlaceMatch()).isNull();
        assertThat(row.getThirdPlaceWinner()).isNull();
        assertThat(row.getName()).isEqualTo("Ana");
        assertThat(row.getTotal()).isEqualTo(42);
    }
}
