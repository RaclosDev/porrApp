package app.porrapp.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class PokerDTO {
    private PokerDTO() {
    }

    public record CreateLeague(@NotBlank @Size(max = 60) String name, @NotNull UUID creationKey) {
    }

    public record CreateSession(@NotNull LocalDate date, @NotNull @Valid Settings settings) {
    }

    public record EditSession(@NotNull LocalDate date, @NotNull @Valid Settings settings,
                              @NotNull @Min(0) Long revision) {
    }

    public record Attendance(@Min(1) Long playerId, @NotNull Boolean attending) {
    }

    public record Command(@NotNull Action action, @NotNull @Min(0) Long revision, @Min(1) Long playerId) {
    }

    public enum Action {
        START, PAUSE, RESUME, NEXT_LEVEL, REBUY, ADD_ON, UNDO_REBUY, UNDO_ADD_ON, ELIMINATE, UNDO_ELIMINATION, CLOSE, CANCEL
    }

    public record Settings(@Min(0) @Max(1000000) int buyInCents,
                           @Min(1) @Max(10000000) int startingChips,
                           @Valid Extra rebuy, @Valid Extra addOn,
                           @NotNull @Size(min = 1, max = 20) List<@NotNull @Min(1) @Max(100) Integer> prizeShares,
                           @NotNull @Size(min = 1, max = 30) List<@NotNull @Valid BlindLevel> levels) {
    }

    public record Extra(@Min(0) @Max(1000000) int costCents,
                        @Min(1) @Max(10000000) int chips,
                        @Min(1) @Max(20) int limit,
                        @Min(1) @Max(30) int throughLevel) {
    }

    public record BlindLevel(@Min(1) @Max(120) int minutes,
                             @Min(0) @Max(10000000) int small,
                             @Min(0) @Max(10000000) int big,
                             @Min(0) @Max(10000000) int ante) {
    }

    public record BlindClock(int level, Long endsAt, long remainingMs) {
    }

    public record Entry(long playerId, String name, int rebuys, int addOns) {
        public Entry rebuy() {
            return new Entry(playerId, name, rebuys + 1, addOns);
        }

        public Entry addOn() {
            return new Entry(playerId, name, rebuys, addOns + 1);
        }

        public Entry undoExtra(boolean rebuy) {
            return new Entry(playerId, name, rebuys - (rebuy ? 1 : 0), addOns - (rebuy ? 0 : 1));
        }
    }

    public record Player(long id, String name, boolean guest, Long userId, String avatarUrl) {
    }

    public record Result(long playerId, String name, int place, long paidCents, long prizeCents,
                         int rebuys, int addOns) {
    }

    public record Session(long id, long revision, LocalDate date, Long startedAt, Long closedAt,
                          Settings settings, List<Entry> entries, List<Long> eliminations,
                          BlindClock clock, long potCents, List<Long> prizes, List<Result> results) {
    }

    public record LeagueView(long id, String name, String joinCode, boolean owner, Long myPlayerId,
                             List<Player> players, Session current, long serverNow) {
    }
}
