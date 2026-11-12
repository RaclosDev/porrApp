package app.porrapp.dto;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;

/** Participant names are supplied by the organizer. The view contains no account data. */
public record OrganizedTournamentDTO(Long id, String name, String activity, String participantType,
        String format, boolean published, String publicId, boolean canEdit, long revision, int winPoints, int drawPoints,
        int lossPoints, List<Participant> participants, List<Match> matches, List<Standing> standings) {
    public record Participant(String id, String name) {}
    public record Match(String id, int round, int position, String homeId, String awayId,
            Instant scheduledAt, String venue, Integer homeScore, Integer awayScore, String outcome, boolean bye) {
        public Match withResult(Integer home, Integer away, String result) {
            return new Match(id, round, position, homeId, awayId, scheduledAt, venue, home, away, result, bye);
        }
    }
    public record Standing(String participantId, int played, int won, int drawn, int lost,
            long scored, long conceded, long points) {}
    public record Create(@NotBlank @Size(max = 80) String name, @NotBlank @Size(max = 80) String activity,
            @NotNull @Pattern(regexp = "INDIVIDUAL|TEAM|PAIR") String participantType,
            @NotNull java.util.UUID creationKey) {}
    public record ParticipantInput(@PositiveOrZero long revision, @NotBlank @Size(max = 80) String name) {}
    public record Swap(@PositiveOrZero long revision, @NotBlank String firstId, @NotBlank String secondId) {}
    public record Publication(@PositiveOrZero long revision, boolean published) {}
    public record Schedule(@PositiveOrZero long revision, @NotNull @Pattern(regexp = "LEAGUE|KNOCKOUT") String format,
            @NotNull @Pattern(regexp = "RANDOM|SEEDED|MANUAL") String draw,
            @Min(1) @Max(2) int legs, @Min(0) @Max(100) int winPoints,
            @Min(0) @Max(100) int drawPoints, @Min(0) @Max(100) int lossPoints) {}
    public record Order(@PositiveOrZero long revision, @NotNull @Size(min = 2, max = 64) List<@NotBlank String> participantIds) {}
    public record MatchInput(@PositiveOrZero long revision, @Min(1) @Max(1000) int round,
            @NotBlank String homeId, @NotBlank String awayId, Instant scheduledAt, @Size(max = 120) String venue) {}
    public record MatchDetails(@PositiveOrZero long revision, Instant scheduledAt, @Size(max = 120) String venue) {}
    public record Result(@PositiveOrZero long revision, @Min(0) @Max(1000000) Integer homeScore,
            @Min(0) @Max(1000000) Integer awayScore, @Pattern(regexp = "HOME|AWAY|DRAW") String outcome) {}
}
