package app.porrapp.service.league;

import app.porrapp.dto.PokerDTO.*;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.PokerSession;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

final class PokerTournament {
    static final int MAX_ENTRIES = 20;

    private PokerTournament() {
    }

    static void validate(Settings settings) {
        if (settings.prizeShares().stream().mapToInt(Integer::intValue).sum() != 100) {
            throw BusinessException.badRequest("El reparto de premios debe sumar el 100 %");
        }
        var levels = settings.levels();
        if (levels.getFirst().big() == 0 || levels.getLast().big() == 0
                || levels.stream().anyMatch(level -> level.big() == 0
                    ? level.small() != 0 || level.ante() != 0
                    : level.small() == 0 || level.small() >= level.big())) {
            throw BusinessException.badRequest("Revisa las ciegas. Un descanso debe tener ciegas y ante a cero");
        }
        if (settings.rebuy() != null && settings.rebuy().throughLevel() > levels.size()
                || settings.addOn() != null && (settings.addOn().throughLevel() > levels.size()
                || settings.addOn().limit() != 1)) {
            throw BusinessException.badRequest("Revisa hasta qué nivel se permiten las recompras y el extra de fichas");
        }
    }

    static void apply(PokerSession session, Command command, long now) {
        if (command.action() == Action.START) {
            start(session, now);
            return;
        }
        if (session.getStartedAt() == null) {
            throw BusinessException.conflict("El torneo todavía no ha empezado");
        }
        BlindClock clock = clockAt(session.getBlindClock(), session.getSettings().levels(), now);
        switch (command.action()) {
            case PAUSE -> {
                if (clock.endsAt() != null) {
                    session.setBlindClock(new BlindClock(clock.level(), null, clock.remainingMs()));
                }
            }
            case RESUME -> {
                if (clock.endsAt() == null && clock.remainingMs() > 0) {
                    session.setBlindClock(new BlindClock(clock.level(), now + clock.remainingMs(), clock.remainingMs()));
                }
            }
            case NEXT_LEVEL -> {
                int next = clock.level() + 1;
                if (next >= session.getSettings().levels().size()) {
                    throw BusinessException.conflict("Ya estáis en el último nivel");
                }
                long duration = duration(session.getSettings().levels().get(next));
                Long endsAt = clock.endsAt() == null ? null : now + duration;
                session.setBlindClock(new BlindClock(next, endsAt, duration));
            }
            case REBUY, ADD_ON -> extra(session, command, clock);
            case UNDO_REBUY, UNDO_ADD_ON -> undoExtra(session, command);
            case ELIMINATE -> eliminate(session, command.playerId());
            case UNDO_ELIMINATION -> {
                if (!session.getEliminations().isEmpty()) {
                    session.setEliminations(new ArrayList<>(
                            session.getEliminations().subList(0, session.getEliminations().size() - 1)));
                }
            }
            case CLOSE -> {
                if (command.finalStacks() != null) {
                    finishStacks(session, command.finalStacks());
                } else if (remaining(session) != 1) {
                    throw BusinessException.conflict("Para cerrar, tiene que quedar un solo jugador");
                }
                session.setBlindClock(new BlindClock(clock.level(), null, clock.remainingMs()));
                session.setClosedAt(now);
            }
            default -> throw new IllegalArgumentException("Acción inesperada: " + command.action());
        }
    }

    private static void finishStacks(PokerSession session, List<FinalStack> stacks) {
        var active = session.getEntries().stream()
                .filter(entry -> !session.getEliminations().contains(entry.playerId())).toList();
        var ids = stacks.stream().map(FinalStack::playerId).collect(java.util.stream.Collectors.toSet());
        if (stacks.size() != active.size() || ids.size() != stacks.size()
                || !ids.equals(active.stream().map(Entry::playerId).collect(java.util.stream.Collectors.toSet()))
                || stacks.stream().anyMatch(stack -> stack.chips() < 0)) {
            throw BusinessException.badRequest("Indica las fichas de todos los jugadores que siguen en la mesa");
        }
        Settings settings = session.getSettings();
        long total = session.getEntries().stream().mapToLong(entry -> settings.startingChips()
                + (settings.rebuy() == null ? 0L : (long) settings.rebuy().chips() * entry.rebuys())
                + (settings.addOn() == null ? 0L : (long) settings.addOn().chips() * entry.addOns())).sum();
        if (stacks.stream().mapToLong(FinalStack::chips).sum() != total) {
            throw BusinessException.badRequest("La suma debe coincidir con las fichas en juego: " + total);
        }
        session.setEntries(session.getEntries().stream().map(entry -> new Entry(entry.playerId(), entry.name(),
                entry.rebuys(), entry.addOns(), stacks.stream().filter(stack -> stack.playerId() == entry.playerId())
                        .map(FinalStack::chips).findFirst().orElse(0L))).toList());
    }

    private static void start(PokerSession session, long now) {
        if (session.getStartedAt() != null) throw BusinessException.conflict("El torneo ya ha empezado");
        int count = session.getEntries().size();
        if (count < 2) throw BusinessException.badRequest("Confirma al menos dos jugadores");
        if (count < session.getSettings().prizeShares().size()) {
            throw BusinessException.badRequest("Hay más puestos premiados que jugadores. Ajusta el reparto");
        }
        long duration = duration(session.getSettings().levels().getFirst());
        session.setBlindClock(new BlindClock(0, now + duration, duration));
        session.setStartedAt(now);
    }

    private static void eliminate(PokerSession session, Long playerId) {
        activeEntry(session, playerId);
        var order = new ArrayList<>(session.getEliminations());
        order.add(playerId);
        session.setEliminations(order);
    }

    private static void extra(PokerSession session, Command command, BlindClock clock) {
        Entry player = activeEntry(session, command.playerId());
        boolean rebuy = command.action() == Action.REBUY;
        Extra option = rebuy ? session.getSettings().rebuy() : session.getSettings().addOn();
        int count = rebuy ? player.rebuys() : player.addOns();
        if (option == null || count >= option.limit() || clock.level() >= option.throughLevel()
                || clock.remainingMs() == 0) {
            throw BusinessException.conflict("Ese extra de fichas ya no está disponible para este jugador");
        }
        replaceEntry(session, rebuy ? player.rebuy() : player.addOn());
    }

    private static void undoExtra(PokerSession session, Command command) {
        Entry player = session.getEntries().stream()
                .filter(entry -> command.playerId() != null && entry.playerId() == command.playerId()).findFirst()
                .orElseThrow(() -> BusinessException.notFound("Jugador no encontrado"));
        boolean rebuy = command.action() == Action.UNDO_REBUY;
        if ((rebuy ? player.rebuys() : player.addOns()) == 0) {
            throw BusinessException.conflict("Este jugador no tiene ningún extra de ese tipo");
        }
        replaceEntry(session, player.undoExtra(rebuy));
    }

    private static void replaceEntry(PokerSession session, Entry player) {
        session.setEntries(session.getEntries().stream()
                .map(entry -> entry.playerId() == player.playerId() ? player : entry).toList());
    }

    private static Entry activeEntry(PokerSession session, Long playerId) {
        if (playerId == null || remaining(session) <= 1 || session.getEliminations().contains(playerId)) {
            throw BusinessException.conflict("El jugador no está en juego");
        }
        return session.getEntries().stream().filter(entry -> entry.playerId() == playerId).findFirst()
                .orElseThrow(() -> BusinessException.conflict("El jugador no está en juego"));
    }

    private static int remaining(PokerSession session) {
        return session.getEntries().size() - session.getEliminations().size();
    }

    private static long duration(BlindLevel level) {
        return level.minutes() * 60_000L;
    }

    static BlindClock clockAt(BlindClock clock, List<BlindLevel> levels, long now) {
        if (clock == null || clock.endsAt() == null) return clock;
        int level = clock.level();
        long deadline = clock.endsAt();
        while (deadline <= now && level + 1 < levels.size()) {
            deadline += duration(levels.get(++level));
        }
        return deadline <= now
                ? new BlindClock(level, null, 0)
                : new BlindClock(level, deadline, deadline - now);
    }

    private static long paid(Entry entry, Settings settings) {
        return settings.buyInCents()
                + (settings.rebuy() == null ? 0L : (long) settings.rebuy().costCents() * entry.rebuys())
                + (settings.addOn() == null ? 0L : (long) settings.addOn().costCents() * entry.addOns());
    }

    static List<Long> prizes(long pot, List<Integer> shares) {
        var prizes = new ArrayList<>(shares.stream().map(share -> pot * share / 100).toList());
        long remainder = pot - prizes.stream().mapToLong(Long::longValue).sum();
        prizes.set(0, prizes.getFirst() + remainder);
        return List.copyOf(prizes);
    }

    static Session view(PokerSession session, long now) {
        Settings settings = session.getSettings();
        List<Entry> entries = session.getEntries();
        List<Long> order = session.getEliminations();
        long pot = entries.stream().mapToLong(entry -> paid(entry, settings)).sum();
        List<Long> prizes = prizes(pot, settings.prizeShares());
        List<Result> results = session.getClosedAt() == null ? List.of() : entries.stream()
                .map(entry -> {
                    int index = order.indexOf(entry.playerId());
                    int place = index < 0 ? 1 : entries.size() - index;
                    long prize;
                    if (index < 0 && entry.finalChips() != null) {
                        var survivors = entries.stream().filter(other -> !order.contains(other.playerId())).toList();
                        place = 1 + (int) survivors.stream().filter(other -> other.finalChips() > entry.finalChips()).count();
                        var tied = survivors.stream().filter(other -> other.finalChips().equals(entry.finalChips()))
                                .sorted(Comparator.comparingLong(Entry::playerId)).toList();
                        long shared = prizes.stream().skip(place - 1).limit(tied.size()).mapToLong(Long::longValue).sum();
                        prize = shared / tied.size() + (tied.indexOf(entry) < shared % tied.size() ? 1 : 0);
                    } else {
                        prize = place <= prizes.size() ? prizes.get(place - 1) : 0;
                    }
                    return new Result(entry.playerId(), entry.name(), place, paid(entry, settings),
                            prize, entry.rebuys(), entry.addOns(), entry.finalChips());
                })
                .sorted(Comparator.comparingInt(Result::place)).toList();
        return new Session(session.getId(), session.getRevision(), session.getScheduledOn(),
                session.getStartedAt(), session.getClosedAt(), settings, entries, order,
                clockAt(session.getBlindClock(), settings.levels(), now), pot, prizes, results);
    }
}
