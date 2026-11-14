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
    /** Tope de un premio fijo: 10 millones de euros. */
    public static final long MAX_PRIZE_CENTS = 1_000_000_000L;

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

    public record Command(@NotNull Action action, @NotNull @Min(0) Long revision, @Min(1) Long playerId,
                          @Size(max = 20) List<@NotNull @Valid FinalStack> finalStacks,
                          @Size(min = 1, max = 20) List<@NotNull @Min(1) @Max(100) Integer> prizeShares,
                          /** Reparto en cantidades fijas (céntimos por puesto); excluye a {@code prizeShares}. */
                          @Size(min = 1, max = 20) List<@NotNull @Min(1) @Max(MAX_PRIZE_CENTS) Long> prizeAmounts) {
        public Command(Action action, Long revision, Long playerId) {
            this(action, revision, playerId, null, null, null);
        }

        public Command(Action action, Long revision, Long playerId, List<FinalStack> finalStacks) {
            this(action, revision, playerId, finalStacks, null, null);
        }

        public Command(Action action, Long revision, Long playerId, List<FinalStack> finalStacks,
                       List<Integer> prizeShares) {
            this(action, revision, playerId, finalStacks, prizeShares, null);
        }
    }

    public record FinalStack(@Min(1) long playerId, @Min(0) @Max(9000000000L) long chips) {
    }

    public enum Action {
        START, PAUSE, RESUME, NEXT_LEVEL, REBUY, ADD_ON, UNDO_REBUY, UNDO_ADD_ON, ELIMINATE, UNDO_ELIMINATION, SET_PRIZES, CLOSE, CANCEL
    }

    public record Settings(@Min(0) @Max(1000000) int buyInCents,
                           @Min(1) @Max(10000000) int startingChips,
                           @Valid Extra rebuy, @Valid Extra addOn,
                           @NotNull @Size(min = 1, max = 20) List<@NotNull @Min(1) @Max(100) Integer> prizeShares,
                           @NotNull @Size(min = 1, max = 30) List<@NotNull @Valid BlindLevel> levels,
                           /** Cantidades fijas por puesto en céntimos; null si el reparto va por porcentajes. */
                           @Size(min = 1, max = 20) List<@NotNull @Min(1) @Max(MAX_PRIZE_CENTS) Long> prizeAmounts) {
        public Settings(int buyInCents, int startingChips, Extra rebuy, Extra addOn, List<Integer> prizeShares,
                        List<BlindLevel> levels) {
            this(buyInCents, startingChips, rebuy, addOn, prizeShares, levels, null);
        }

        /** Puestos con premio, sea cual sea el modo del reparto. */
        public int prizePlaces() {
            return prizeAmounts != null ? prizeAmounts.size() : prizeShares.size();
        }
    }

    public record Extra(@Min(0) @Max(1000000) int costCents,
                        @Min(1) @Max(10000000) int chips,
                        /** Máximo por jugador; null si no tiene límite. */
                        @Min(1) @Max(20) Integer limit,
                        @Min(1) @Max(30) int throughLevel) {
    }

    public record BlindLevel(@Min(1) @Max(120) int minutes,
                             @Min(0) @Max(10000000) int small,
                             @Min(0) @Max(10000000) int big,
                             @Min(0) @Max(10000000) int ante) {
    }

    public record BlindClock(int level, Long endsAt, long remainingMs) {
    }

    public record Entry(long playerId, String name, int rebuys, int addOns, Long finalChips) {
        public Entry(long playerId, String name, int rebuys, int addOns) {
            this(playerId, name, rebuys, addOns, null);
        }

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
                         int rebuys, int addOns, Long finalChips) {
    }

    public record Session(long id, long revision, LocalDate date, Long startedAt, Long closedAt,
                          Settings settings, List<Entry> entries, List<Long> eliminations,
                          BlindClock clock, long potCents, List<Long> prizes, List<Result> results) {
    }

    public record LeagueView(long id, String name, String joinCode, boolean owner, Long myPlayerId,
                             List<Player> players, Session current, long serverNow) {
    }

    public record Track(String videoId, String title, String channel) {
    }

    public record MusicSearch(boolean available, List<Track> results) {
    }

    public record AddTrack(@NotBlank @Size(max = 11) String videoId, @NotBlank @Size(max = 150) String title,
                           @Size(max = 100) String channel) {
    }

    public record QueuedTrack(long id, String videoId, String title, String channel, String addedBy,
                              boolean removable) {
    }

    public record MusicQueue(boolean organizer, boolean searchAvailable, List<QueuedTrack> items) {
    }
}
