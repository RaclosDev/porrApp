
package app.porrapp.service.league;

import app.porrapp.dto.PokerDTO.*;
import app.porrapp.model.PokerSession;
import app.porrapp.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PokerTournamentTest {
    @Test
    void closesWithStacksAndSharesTiedPrizesWithoutLosingCents() {
        var session = activeSession();
        PokerTournament.apply(session, new Command(
                Action.CLOSE, 0L, null, List.of(
                new FinalStack(1, 150),
                new FinalStack(2, 150))), 1000);
        var result = PokerTournament.view(session, 1000);
        assertThat(result.closedAt()).isEqualTo(1000);
        assertThat(result.clock().endsAt()).isNull();
        assertThat(result.results()).extracting(Result::place).containsExactly(1, 1, 3);
        assertThat(result.results()).extracting(Result::finalChips).containsExactly(150L, 150L, 0L);
        assertThat(result.results().stream().mapToLong(Result::prizeCents).sum()).isEqualTo(303);
    }

    @Test
    void ranksSurvivorsByChipsAndKeepsEliminatedPlaces() {
        var session = activeSession();
        PokerTournament.apply(session, new Command(
                Action.CLOSE, 0L, null, List.of(
                new FinalStack(1, 100),
                new FinalStack(2, 200))), 1000);
        assertThat(PokerTournament.view(session, 1000).results())
                .extracting(Result::playerId).containsExactly(2L, 1L, 3L);
    }

    @Test
    void rejectsMissingDuplicateAndIncorrectStackTotals() {
        for (var stacks : List.of(
                List.of(new FinalStack(1, 300)),
                List.of(new FinalStack(1, 150), new FinalStack(1, 150)),
                List.of(new FinalStack(1, 100), new FinalStack(2, 100)))) {
            var session = activeSession();
            assertThatThrownBy(() -> PokerTournament.apply(session,
                    new Command(Action.CLOSE, 0L, null, stacks), 1000))
                    .isInstanceOf(BusinessException.class);
            assertThat(session.getClosedAt()).isNull();
        }
    }

    @Test
    void rebuysWithoutLimitKeepGoingAndLimitedOnesStop() {
        var unlimited = activeSession();
        unlimited.setSettings(new Settings(101, 100, new Extra(100, 100, null, 1), null,
                List.of(70, 30), List.of(new BlindLevel(10, 1, 2, 0))));
        for (int i = 0; i < 25; i++) {
            PokerTournament.apply(unlimited, new Command(Action.REBUY, 0L, 1L), 1000);
        }
        assertThat(unlimited.getEntries().getFirst().rebuys()).isEqualTo(25);

        var limited = activeSession();
        limited.setSettings(new Settings(101, 100, new Extra(100, 100, 2, 1), null,
                List.of(70, 30), List.of(new BlindLevel(10, 1, 2, 0))));
        PokerTournament.apply(limited, new Command(Action.REBUY, 0L, 1L), 1000);
        PokerTournament.apply(limited, new Command(Action.REBUY, 0L, 1L), 1000);
        assertThatThrownBy(() -> PokerTournament.apply(limited, new Command(Action.REBUY, 0L, 1L), 1000))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void addOnsFollowTheirOwnLimitPerPlayer() {
        var limited = activeSession();
        var levels = List.of(new BlindLevel(10, 1, 2, 0));
        limited.setSettings(new Settings(101, 100, null, new Extra(100, 100, 2, 1), List.of(70, 30), levels));
        PokerTournament.validate(limited.getSettings());
        PokerTournament.apply(limited, new Command(Action.ADD_ON, 0L, 1L), 1000);
        PokerTournament.apply(limited, new Command(Action.ADD_ON, 0L, 1L), 1000);
        assertThatThrownBy(() -> PokerTournament.apply(limited, new Command(Action.ADD_ON, 0L, 1L), 1000))
                .isInstanceOf(BusinessException.class);
        assertThat(limited.getEntries().getFirst().addOns()).isEqualTo(2);

        var unlimited = activeSession();
        unlimited.setSettings(new Settings(101, 100, null, new Extra(100, 100, null, 1), List.of(70, 30), levels));
        PokerTournament.validate(unlimited.getSettings());
        for (int i = 0; i < 5; i++) {
            PokerTournament.apply(unlimited, new Command(Action.ADD_ON, 0L, 1L), 1000);
        }
        assertThat(unlimited.getEntries().getFirst().addOns()).isEqualTo(5);
    }

    @Test
    void theBreakRightAfterTheCutoffStillAllowsBuying() {
        var session = activeSession();
        var pause = new BlindLevel(10, 0, 0, 0);
        session.setSettings(new Settings(101, 100, new Extra(100, 100, null, 1), null, List.of(70, 30),
                List.of(new BlindLevel(10, 1, 2, 0), pause, new BlindLevel(10, 2, 4, 0))));
        session.setBlindClock(new BlindClock(1, null, 600000));
        PokerTournament.apply(session, new Command(Action.REBUY, 0L, 1L), 1000);
        assertThat(session.getEntries().getFirst().rebuys()).isEqualTo(1);

        session.setBlindClock(new BlindClock(2, null, 600000));
        assertThatThrownBy(() -> PokerTournament.apply(session, new Command(Action.REBUY, 0L, 1L), 1000))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void anyEliminationCanBeUndoneAndARebuyBringsThePlayerBack() {
        var session = activeSession();
        session.setSettings(new Settings(101, 100, new Extra(100, 100, null, 1), null,
                List.of(70, 30), List.of(new BlindLevel(10, 1, 2, 0))));
        PokerTournament.apply(session, new Command(Action.ELIMINATE, 0L, 1L), 1000);

        PokerTournament.apply(session, new Command(Action.UNDO_ELIMINATION, 0L, 3L), 1000);
        assertThat(session.getEliminations()).containsExactly(1L);
        assertThatThrownBy(() -> PokerTournament.apply(session, new Command(Action.UNDO_ELIMINATION, 0L, 3L), 1000))
                .isInstanceOf(BusinessException.class);

        PokerTournament.apply(session, new Command(Action.REBUY, 0L, 1L), 1000);
        assertThat(session.getEliminations()).isEmpty();
        assertThat(session.getEntries().getFirst().rebuys()).isEqualTo(1);
    }

    @Test
    void prizesCanBeChangedDuringTheTournament() {
        var session = activeSession();
        PokerTournament.apply(session, new Command(Action.SET_PRIZES, 0L, null, null, List.of(50, 30, 20)), 1000);
        assertThat(session.getSettings().prizeShares()).containsExactly(50, 30, 20);
        assertThat(PokerTournament.view(session, 1000).prizes()).containsExactly(153L, 90L, 60L);
        for (var shares : List.of(List.of(60, 30), List.of(40, 30, 20, 10))) {
            assertThatThrownBy(() -> PokerTournament.apply(session,
                    new Command(Action.SET_PRIZES, 0L, null, null, shares), 1000))
                    .isInstanceOf(BusinessException.class);
        }
        assertThat(session.getSettings().prizeShares()).containsExactly(50, 30, 20);
    }

    @Test
    void fixedAmountsGiveTheRemainderToTheWinnerAndNeverExceedThePot() {
        var session = activeSession();
        PokerTournament.apply(session, new Command(Action.SET_PRIZES, 0L, null, null, null, List.of(150L, 100L)), 1000);
        assertThat(session.getSettings().prizeAmounts()).containsExactly(150L, 100L);
        assertThat(session.getSettings().prizeShares()).containsExactly(70, 30);
        assertThat(PokerTournament.view(session, 1000).prizes()).containsExactly(203L, 100L);
        for (var amounts : List.of(List.of(300L, 4L), List.of(1L, 1L, 1L, 1L))) {
            assertThatThrownBy(() -> PokerTournament.apply(session,
                    new Command(Action.SET_PRIZES, 0L, null, null, null, amounts), 1000))
                    .isInstanceOf(BusinessException.class);
        }
        assertThatThrownBy(() -> PokerTournament.apply(session,
                new Command(Action.SET_PRIZES, 0L, null, null, List.of(100), List.of(303L)), 1000))
                .isInstanceOf(BusinessException.class);

        PokerTournament.apply(session, new Command(Action.SET_PRIZES, 0L, null, null, List.of(100)), 1000);
        assertThat(session.getSettings().prizeAmounts()).isNull();
        assertThat(PokerTournament.view(session, 1000).prizes()).containsExactly(303L);
    }

    @Test
    void closingSavesTheAgreedPrizes() {
        var session = activeSession();
        PokerTournament.apply(session, new Command(Action.CLOSE, 0L, null,
                List.of(new FinalStack(1, 200), new FinalStack(2, 100)), null, List.of(200L, 103L)), 1000);
        assertThat(PokerTournament.view(session, 1000).results())
                .extracting(Result::prizeCents).containsExactly(200L, 103L, 0L);

        var tooMuch = activeSession();
        assertThatThrownBy(() -> PokerTournament.apply(tooMuch, new Command(Action.CLOSE, 0L, null,
                List.of(new FinalStack(1, 200), new FinalStack(2, 100)), null, List.of(300L, 100L)), 1000))
                .isInstanceOf(BusinessException.class);
        assertThat(tooMuch.getClosedAt()).isNull();
    }

    @Test
    void closingWithHandPickedPayoutsKeepsTheLeftoverWithoutCheckingThePot() {
        var session = activeSession();
        PokerTournament.apply(session, new Command(Action.CLOSE, 0L, null,
                List.of(new FinalStack(1, 200), new FinalStack(2, 100)), null, null, List.of(
                new Payout(1, 150, new BigDecimal("4")), new Payout(2, 100, new BigDecimal("4")))), 1000);
        var view = PokerTournament.view(session, 1000);
        assertThat(view.results()).extracting(Result::prizeCents).containsExactly(150L, 100L, 0L);
        assertThat(view.results()).extracting(Result::points)
                .containsExactly(new BigDecimal("4.00"), new BigDecimal("4.00"), new BigDecimal("0.00"));
        assertThat(view.leftoverCents()).isEqualTo(53);

        var overPot = activeSession();
        PokerTournament.apply(overPot, new Command(Action.CLOSE, 0L, null,
                List.of(new FinalStack(1, 200), new FinalStack(2, 100)), null, null,
                List.of(new Payout(1, 400, BigDecimal.ONE))), 1000);
        assertThat(PokerTournament.view(overPot, 1000).leftoverCents()).isEqualTo(-97);

        var stranger = activeSession();
        assertThatThrownBy(() -> PokerTournament.apply(stranger, new Command(Action.CLOSE, 0L, null,
                List.of(new FinalStack(1, 200), new FinalStack(2, 100)), null, null,
                List.of(new Payout(9, 100, BigDecimal.ONE))), 1000)).isInstanceOf(BusinessException.class);
    }

    @Test
    void aPactWithoutCountingChipsSharesFirstPlace() {
        var session = activeSession();
        PokerTournament.apply(session, new Command(Action.CLOSE, 0L, null, null, null, null, List.of(
                new Payout(1, 150, new BigDecimal("4.5")), new Payout(2, 150, new BigDecimal("4.5")))), 1000);
        var view = PokerTournament.view(session, 1000);
        assertThat(view.results()).extracting(Result::place).containsExactly(1, 1, 3);
        assertThat(view.results()).extracting(Result::prizeCents).containsExactly(150L, 150L, 0L);

        var noPact = activeSession();
        assertThatThrownBy(() -> PokerTournament.apply(noPact, new Command(Action.CLOSE, 0L, null, null), 1000))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void pointsFollowThePlaceWhenNothingWasPickedAndTiesShareThem() {
        var session = activeSession();
        PokerTournament.apply(session, new Command(Action.CLOSE, 0L, null,
                List.of(new FinalStack(1, 150), new FinalStack(2, 150))), 1000);
        var view = PokerTournament.view(session, 1000);
        assertThat(view.results()).extracting(Result::points)
                .containsExactly(new BigDecimal("4.50"), new BigDecimal("4.50"), new BigDecimal("0.00"));
        assertThat(view.leftoverCents()).isZero();
        assertThat(PokerTournament.pointsScale(1)).containsExactly(900L);
        assertThat(PokerTournament.pointsScale(3)).containsExactly(500L, 300L, 100L);
        assertThat(PokerTournament.pointsScale(5)).containsExactly(500L, 300L, 100L);
    }

    @Test
    void customPointsReplaceTheScaleAndOnlyCountPaidPlaces() {
        var custom = new Settings(100, 100, null, null, List.of(60, 40), List.of(new BlindLevel(10, 1, 2, 0)),
                null, null, null, List.of(10, 2, 1));
        assertThat(PokerTournament.points(custom)).containsExactly(1000L, 200L);
        assertThat(PokerTournament.points(custom.withPrizes(List.of(100), null))).containsExactly(1000L);
    }

    @Test
    void editingAClosedTournamentKeepsStacksUnlessTheOrderChanges() {
        var session = activeSession();
        PokerTournament.apply(session, new Command(Action.CLOSE, 0L, null,
                List.of(new FinalStack(1, 200), new FinalStack(2, 100))), 1000);
        var day = java.time.LocalDate.of(2026, 11, 7);
        PokerTournament.editResults(session, new EditResults(day, 0L, List.of(
                new ResultEdit(1, 0, 0), new ResultEdit(2, 0, 0), new ResultEdit(3, 0, 0))));
        assertThat(session.getScheduledOn()).isEqualTo(day);
        assertThat(PokerTournament.view(session, 1000).results()).extracting(Result::finalChips)
                .containsExactly(200L, 100L, 0L);

        PokerTournament.editResults(session, new EditResults(day, 0L, List.of(
                new ResultEdit(3, 0, 0), new ResultEdit(1, 0, 0), new ResultEdit(2, 0, 0))));
        var reordered = PokerTournament.view(session, 1000);
        assertThat(reordered.results()).extracting(Result::playerId).containsExactly(3L, 1L, 2L);
        assertThat(reordered.results()).extracting(Result::place).containsExactly(1, 2, 3);
        assertThat(reordered.results()).extracting(Result::finalChips).containsOnlyNulls();

        assertThatThrownBy(() -> PokerTournament.editResults(session, new EditResults(day, 0L, List.of(
                new ResultEdit(3, 1, 0), new ResultEdit(1, 0, 0), new ResultEdit(2, 0, 0)))))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> PokerTournament.editResults(session, new EditResults(day, 0L, List.of(
                new ResultEdit(3, 0, 0), new ResultEdit(3, 0, 0), new ResultEdit(2, 0, 0)))))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void clearingStacksKeepsThePayoutsAndLeavesTheSurvivorsAsADeal() {
        var session = activeSession();
        PokerTournament.apply(session, new Command(Action.CLOSE, 0L, null,
                List.of(new FinalStack(1, 200), new FinalStack(2, 100))), 1000);
        var day = java.time.LocalDate.of(2026, 11, 7);
        PokerTournament.editResults(session, new EditResults(day, 0L, List.of(
                new ResultEdit(1, 0, 0, 200L, new BigDecimal("5")),
                new ResultEdit(2, 0, 0, 100L, new BigDecimal("4")),
                new ResultEdit(3, 0, 0, 0L, BigDecimal.ZERO)), null, null, null, true));
        var cleared = PokerTournament.view(session, 1000);
        assertThat(cleared.results()).extracting(Result::finalChips).containsOnlyNulls();
        assertThat(cleared.results()).extracting(Result::place).containsExactly(1, 1, 3);
        assertThat(cleared.results()).extracting(Result::prizeCents).containsExactly(200L, 100L, 0L);
    }

    @Test
    void liveEditAddsRebuysAndKeepsWhatWasPlayedOfTheCurrentLevel() {
        var session = activeSession();
        // A los 4 minutos del nivel de 10 se alarga a 15: quedan 11.
        PokerTournament.editLive(session, new Settings(200, 100, new Extra(100, 100, null, 1), null,
                List.of(70, 30), List.of(new BlindLevel(15, 1, 2, 0))), 240001L);
        assertThat(session.getSettings().buyInCents()).isEqualTo(200);
        assertThat(session.getBlindClock().remainingMs()).isEqualTo(660000);
        assertThat(session.getBlindClock().endsAt()).isEqualTo(240001L + 660000);
        PokerTournament.apply(session, new Command(Action.REBUY, 0L, 1L), 240001L);
        assertThat(session.getEntries().getFirst().rebuys()).isEqualTo(1);
    }

    @Test
    void liveEditRejectsDroppingTheCurrentLevelOrRebuysAlreadyMade() {
        var session = activeSession();
        session.setSettings(new Settings(101, 100, new Extra(100, 100, null, 2), null,
                List.of(70, 30), List.of(new BlindLevel(10, 1, 2, 0), new BlindLevel(10, 2, 4, 0))));
        session.setBlindClock(new BlindClock(1, 600001L, 600000));
        PokerTournament.apply(session, new Command(Action.REBUY, 0L, 1L), 1000);
        assertThatThrownBy(() -> PokerTournament.editLive(session, new Settings(101, 100, new Extra(100, 100, null, 1),
                null, List.of(70, 30), List.of(new BlindLevel(10, 1, 2, 0))), 1000))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> PokerTournament.editLive(session, new Settings(101, 100, null, null,
                List.of(70, 30), List.of(new BlindLevel(10, 1, 2, 0), new BlindLevel(10, 2, 4, 0))), 1000))
                .isInstanceOf(BusinessException.class);
        assertThat(session.getSettings().rebuy()).isNotNull();
    }

    @Test
    void removingAPlayerMidTournamentAlsoForgetsTheirElimination() {
        var session = activeSession();
        PokerTournament.removeEntry(session, 3L);
        assertThat(session.getEntries()).extracting(Entry::playerId).containsExactly(1L, 2L);
        assertThat(session.getEliminations()).isEmpty();
    }

    private PokerSession activeSession() {
        var session = new PokerSession();
        session.setId(1L);
        session.setStartedAt(1L);
        session.setSettings(new Settings(101, 100, null, null,
                List.of(70, 30), List.of(new BlindLevel(10, 1, 2, 0))));
        session.setEntries(List.of(new Entry(1, "Ana", 0, 0),
                new Entry(2, "Luis", 0, 0), new Entry(3, "Paz", 0, 0)));
        session.setEliminations(List.of(3L));
        session.setBlindClock(new BlindClock(0, 600001L, 600000));
        return session;
    }

    @Test
    void clockAdvancesAcrossBreaksEvenWithNoClientConnected() {
        var levels = List.of(new BlindLevel(1, 25, 50, 0), new BlindLevel(2, 0, 0, 0),
                new BlindLevel(1, 50, 100, 10));
        var started = new BlindClock(0, 60_000L, 60_000L);
        assertThat(PokerTournament.clockAt(started, levels, 60_000)).isEqualTo(new BlindClock(1, 180_000L, 120_000));
        assertThat(PokerTournament.clockAt(started, levels, 181_000)).isEqualTo(new BlindClock(2, 240_000L, 59_000));
        assertThat(PokerTournament.clockAt(started, levels, 250_000)).isEqualTo(new BlindClock(2, null, 0));
        var paused = new BlindClock(1, null, 1000);
        assertThat(PokerTournament.clockAt(paused, levels, 250_000)).isEqualTo(paused);
    }

    @Test
    void allCentsArePaidEvenWhenPercentagesRoundDown() {
        assertThat(PokerTournament.prizes(8027, List.of(60, 30, 10))).containsExactly(4817L, 2408L, 802L);
    }
}
