package app.porrapp.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class PokerDTO {
    /** Tope de un premio fijo: 10 millones de euros. */
    public static final long MAX_PRIZE_CENTS = 1_000_000_000L;
    /** Jugadores por torneo. */
    public static final int MAX_ENTRIES = 100;

    private PokerDTO() {
    }

    public record CreateLeague(@NotBlank @Size(max = 60) String name, @NotNull UUID creationKey) {
    }

    public record CreateSession(@NotNull LocalDate date, @NotNull @Valid Settings settings) {
    }

    public record EditSession(@NotNull LocalDate date, @NotNull @Valid Settings settings,
                              @NotNull @Min(0) Long revision) {
    }

    /**
     * Corrección de un torneo cerrado: fecha, jugadores en el orden final (del 1.º al último) y, si vienen,
     * lo que costaron la entrada, la recompra y el add-on. Lo que llegue a null se queda como estaba.
     * Con {@code clearChips} se quitan las fichas finales: los que seguían en la mesa quedan como en un
     * pacto sin contarlas.
     */
    public record EditResults(@NotNull LocalDate date, @NotNull @Min(0) Long revision,
                              @NotNull @Size(min = 1, max = 100) List<@NotNull @Valid ResultEdit> standings,
                              @Min(0) @Max(1000000) Integer buyInCents,
                              @Min(0) @Max(1000000) Integer rebuyCostCents,
                              @Min(0) @Max(1000000) Integer addOnCostCents,
                              Boolean clearChips) {
        public EditResults(LocalDate date, Long revision, List<ResultEdit> standings) {
            this(date, revision, standings, null, null, null, null);
        }

        public EditResults(LocalDate date, Long revision, List<ResultEdit> standings, Integer buyInCents,
                           Integer rebuyCostCents, Integer addOnCostCents) {
            this(date, revision, standings, buyInCents, rebuyCostCents, addOnCostCents, null);
        }
    }

    /** Un jugador del torneo corregido; con premio y puntos fija los suyos en vez de calcularlos por el puesto. */
    public record ResultEdit(@Min(1) long playerId, @Min(0) @Max(99) int rebuys, @Min(0) @Max(99) int addOns,
                             @Min(0) @Max(MAX_PRIZE_CENTS) Long prizeCents,
                             @DecimalMin("0") @DecimalMax("1000") @Digits(integer = 4, fraction = 2) BigDecimal points) {
        public ResultEdit(long playerId, int rebuys, int addOns) {
            this(playerId, rebuys, addOns, null, null);
        }
    }

    public record Organizing(@NotNull Boolean everyoneOrganizes) {
    }

    public record Attendance(@Min(1) Long playerId, @NotNull Boolean attending) {
    }

    public record Command(@NotNull Action action, @NotNull @Min(0) Long revision, @Min(1) Long playerId,
                          @Size(max = MAX_ENTRIES) List<@NotNull @Valid FinalStack> finalStacks,
                          @Size(min = 1, max = 20) List<@NotNull @Min(1) @Max(100) Integer> prizeShares,
                          /** Reparto en cantidades fijas (céntimos por puesto); excluye a {@code prizeShares}. */
                          @Size(min = 1, max = 20) List<@NotNull @Min(1) @Max(MAX_PRIZE_CENTS) Long> prizeAmounts,
                          /**
                           * Al cerrar: lo que se lleva cada jugador en dinero y en puntos, elegido a mano. No se
                           * comprueba que sume el bote; lo que no se reparte queda como sobrante.
                           */
                          @Size(min = 1, max = MAX_ENTRIES) List<@NotNull @Valid Payout> payouts) {
        public Command(Action action, Long revision, Long playerId) {
            this(action, revision, playerId, null, null, null, null);
        }

        public Command(Action action, Long revision, Long playerId, List<FinalStack> finalStacks,
                       List<Integer> prizeShares, List<Long> prizeAmounts) {
            this(action, revision, playerId, finalStacks, prizeShares, prizeAmounts, null);
        }

        public Command(Action action, Long revision, Long playerId, List<FinalStack> finalStacks) {
            this(action, revision, playerId, finalStacks, null, null, null);
        }

        public Command(Action action, Long revision, Long playerId, List<FinalStack> finalStacks,
                       List<Integer> prizeShares) {
            this(action, revision, playerId, finalStacks, prizeShares, null, null);
        }
    }

    /** Premio en céntimos y puntos (hasta dos decimales) de un jugador al cerrar el torneo. */
    public record Payout(@Min(1) long playerId, @Min(0) @Max(MAX_PRIZE_CENTS) long prizeCents,
                         @NotNull @DecimalMin("0") @DecimalMax("1000") @Digits(integer = 4, fraction = 2)
                         BigDecimal points) {
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
                           @Size(min = 1, max = 20) List<@NotNull @Min(1) @Max(MAX_PRIZE_CENTS) Long> prizeAmounts,
                           /** Cómo se sugieren los puntos de un pacto; null equivale a {@link PactPoints#EQUAL}. */
                           PactPoints pactPoints,
                           /** Redondeo del dinero sugerido al cerrar, en céntimos; null equivale a 1 €. */
                           @Min(1) @Max(100000) Integer roundingCents,
                           /** Puntos de liga enteros por puesto; null usa la escala de siempre (5-3-1). */
                           @Size(min = 1, max = 20) List<@NotNull @Min(0) @Max(1000) Integer> prizePoints) {
        public Settings(int buyInCents, int startingChips, Extra rebuy, Extra addOn, List<Integer> prizeShares,
                        List<BlindLevel> levels, List<Long> prizeAmounts, PactPoints pactPoints,
                        Integer roundingCents) {
            this(buyInCents, startingChips, rebuy, addOn, prizeShares, levels, prizeAmounts, pactPoints,
                    roundingCents, null);
        }

        public Settings(int buyInCents, int startingChips, Extra rebuy, Extra addOn, List<Integer> prizeShares,
                        List<BlindLevel> levels) {
            this(buyInCents, startingChips, rebuy, addOn, prizeShares, levels, null);
        }

        public Settings(int buyInCents, int startingChips, Extra rebuy, Extra addOn, List<Integer> prizeShares,
                        List<BlindLevel> levels, List<Long> prizeAmounts) {
            this(buyInCents, startingChips, rebuy, addOn, prizeShares, levels, prizeAmounts, null, null);
        }

        /** El mismo torneo con otros precios de entrada, recompra y add-on. */
        public Settings withCosts(int newBuyIn, Integer rebuyCost, Integer addOnCost) {
            Extra newRebuy = rebuy == null || rebuyCost == null ? rebuy
                    : new Extra(rebuyCost, rebuy.chips(), rebuy.limit(), rebuy.throughLevel());
            Extra newAddOn = addOn == null || addOnCost == null ? addOn
                    : new Extra(addOnCost, addOn.chips(), addOn.limit(), addOn.throughLevel());
            return new Settings(newBuyIn, startingChips, newRebuy, newAddOn, prizeShares, levels, prizeAmounts,
                    pactPoints, roundingCents, prizePoints);
        }

        /** El mismo torneo con otro reparto del bote. */
        public Settings withPrizes(List<Integer> shares, List<Long> amounts) {
            return new Settings(buyInCents, startingChips, rebuy, addOn, shares, levels, amounts, pactPoints,
                    roundingCents, prizePoints);
        }

        /** Puestos con premio, sea cual sea el modo del reparto. */
        public int prizePlaces() {
            return prizeAmounts != null ? prizeAmounts.size() : prizeShares.size();
        }
    }

    /** Reparto sugerido de los puntos cuando los que siguen en la mesa pactan. */
    public enum PactPoints {
        /** A partes iguales: si quieren pelear por los puntos, que no pacten. */
        EQUAL,
        /** Según el ICM de las fichas finales, como el dinero. */
        ICM
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

    /**
     * Jugador de un torneo. {@code prizeCents} y {@code points} solo existen si al cerrar se eligió a mano
     * lo que se lleva cada uno; si no, salen del puesto.
     */
    public record Entry(long playerId, String name, int rebuys, int addOns, Long finalChips, Long prizeCents,
                        BigDecimal points) {
        public Entry(long playerId, String name, int rebuys, int addOns) {
            this(playerId, name, rebuys, addOns, null);
        }

        public Entry(long playerId, String name, int rebuys, int addOns, Long finalChips) {
            this(playerId, name, rebuys, addOns, finalChips, null, null);
        }

        public Entry renamed(String newName) {
            return new Entry(playerId, newName, rebuys, addOns, finalChips, prizeCents, points);
        }

        public Entry withFinalChips(Long chips) {
            return new Entry(playerId, name, rebuys, addOns, chips, prizeCents, points);
        }

        public Entry withExtras(int newRebuys, int newAddOns) {
            return new Entry(playerId, name, newRebuys, newAddOns, finalChips, prizeCents, points);
        }

        public Entry withPayout(long prize, BigDecimal newPoints) {
            return new Entry(playerId, name, rebuys, addOns, finalChips, prize, newPoints);
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
                         int rebuys, int addOns, Long finalChips, BigDecimal points) {
    }

    public record Session(long id, long revision, LocalDate date, Long startedAt, Long closedAt,
                          Settings settings, List<Entry> entries, List<Long> eliminations,
                          BlindClock clock, long potCents, List<Long> prizes, List<Result> results,
                          /** Bote menos lo repartido al cerrar; negativo si se repartió más que el bote. */
                          long leftoverCents) {
    }

    public record LeagueView(long id, String name, String joinCode, boolean owner, boolean admin,
                             /** Todos los miembros organizan los torneos, no solo la administración. */
                             boolean everyoneOrganizes, Long myPlayerId,
                             List<Player> players, Session current, List<Session> upcoming, long serverNow) {
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
