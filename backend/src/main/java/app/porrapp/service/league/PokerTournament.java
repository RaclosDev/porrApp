package app.porrapp.service.league;

import app.porrapp.dto.PokerDTO.*;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.PokerSession;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

final class PokerTournament {
    static final int MAX_ENTRIES = app.porrapp.dto.PokerDTO.MAX_ENTRIES;

    private PokerTournament() {
    }

    static void validate(Settings settings) {
        validateShares(settings.prizeShares());
        var levels = settings.levels();
        if (levels.getFirst().big() == 0 || levels.getLast().big() == 0
                || levels.stream().anyMatch(level -> level.big() == 0
                    ? level.small() != 0 || level.ante() != 0
                    : level.small() == 0 || level.small() >= level.big())) {
            throw BusinessException.badRequest("Revisa las ciegas. Un descanso debe tener ciegas y ante a cero");
        }
        if (settings.rebuy() != null && settings.rebuy().throughLevel() > levels.size()
                || settings.addOn() != null && settings.addOn().throughLevel() > levels.size()) {
            throw BusinessException.badRequest("Revisa hasta qué nivel se permiten las recompras y el extra de fichas");
        }
    }

    /**
     * Cambia los ajustes con la mesa ya en juego. Lo apuntado tiene que seguir cabiendo: el nivel en curso,
     * las recompras y extras hechos y las cantidades fijas del reparto. Si cambia la duración del nivel en
     * curso, se conserva lo ya jugado de él.
     */
    static void editLive(PokerSession session, Settings settings, long now) {
        validate(settings);
        BlindClock clock = clockAt(session.getBlindClock(), session.getSettings().levels(), now);
        var levels = settings.levels();
        if (clock != null && clock.level() >= levels.size()) {
            throw BusinessException.badRequest("El torneo va por el nivel " + (clock.level() + 1)
                    + ". Deja al menos " + (clock.level() + 1) + " niveles");
        }
        if (session.getEntries().stream().anyMatch(entry -> !allowed(settings.rebuy(), entry.rebuys())
                || !allowed(settings.addOn(), entry.addOns()))) {
            throw BusinessException.badRequest("Hay recompras o extras de fichas apuntados que ya no caben. Quítalos antes");
        }
        Settings before = session.getSettings();
        session.setSettings(settings);
        checkAmountsFit(settings.prizeAmounts(), pot(session));
        if (clock != null && clock.remainingMs() > 0) {
            long played = duration(before.levels().get(clock.level())) - clock.remainingMs();
            long remaining = Math.max(1000L, duration(levels.get(clock.level())) - Math.max(0L, played));
            session.setBlindClock(new BlindClock(clock.level(), clock.endsAt() == null ? null : now + remaining,
                    remaining));
        } else {
            session.setBlindClock(clock);
        }
    }

    /** Saca de la mesa en juego a quien se apuntó por error, con lo que hubiera pagado. */
    static void removeEntry(PokerSession session, long playerId) {
        var entries = new ArrayList<>(session.getEntries());
        if (!entries.removeIf(entry -> entry.playerId() == playerId)) return;
        if (entries.isEmpty()) throw BusinessException.conflict("La mesa no puede quedarse sin jugadores");
        session.setEntries(entries);
        session.setEliminations(session.getEliminations().stream().filter(id -> id != playerId).toList());
        // Si con el bote menor ya no caben las cantidades fijas, el reparto vuelve a los porcentajes.
        Settings settings = session.getSettings();
        List<Long> amounts = settings.prizeAmounts();
        if (amounts != null && amounts.stream().mapToLong(Long::longValue).sum() > pot(session)) {
            session.setSettings(settings.withPrizes(settings.prizeShares(), null));
        }
    }

    private static void validateShares(List<Integer> shares) {
        if (shares == null || shares.isEmpty() || shares.stream().mapToInt(Integer::intValue).sum() != 100) {
            throw BusinessException.badRequest("El reparto de premios debe sumar el 100 %");
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
                if (command.playerId() != null) {
                    revive(session, command.playerId());
                } else if (!session.getEliminations().isEmpty()) {
                    session.setEliminations(new ArrayList<>(
                            session.getEliminations().subList(0, session.getEliminations().size() - 1)));
                }
            }
            case SET_PRIZES -> setPrizes(session, command);
            case CLOSE -> {
                if (command.prizeShares() != null || command.prizeAmounts() != null) {
                    setPrizes(session, command);
                }
                if (command.payouts() == null) checkAmountsFit(session.getSettings().prizeAmounts(), pot(session));
                if (command.finalStacks() != null) {
                    finishStacks(session, command.finalStacks());
                } else if (remaining(session) != 1 && command.payouts() == null) {
                    // Sin fichas solo se cierra con varios en la mesa si pactan el reparto sin contarlas.
                    throw BusinessException.conflict("Para cerrar, tiene que quedar un solo jugador");
                }
                if (command.payouts() != null) setPayouts(session, command.payouts());
                session.setBlindClock(new BlindClock(clock.level(), null, clock.remainingMs()));
                session.setClosedAt(now);
            }
            default -> throw new IllegalArgumentException("Acción inesperada: " + command.action());
        }
    }

    /** Cambia el reparto en juego: por porcentajes o por cantidades fijas que no superen el bote. */
    private static void setPrizes(PokerSession session, Command command) {
        boolean amounts = command.prizeAmounts() != null;
        if (amounts == (command.prizeShares() != null)) {
            throw BusinessException.badRequest("Indica el reparto en porcentajes o en cantidades, no ambos");
        }
        if (!amounts) validateShares(command.prizeShares());
        int places = amounts ? command.prizeAmounts().size() : command.prizeShares().size();
        if (places > session.getEntries().size()) {
            throw BusinessException.badRequest("Hay más puestos premiados que jugadores. Ajusta el reparto");
        }
        if (amounts) checkAmountsFit(command.prizeAmounts(), pot(session));
        Settings old = session.getSettings();
        session.setSettings(old.withPrizes(amounts ? old.prizeShares() : List.copyOf(command.prizeShares()),
                amounts ? List.copyOf(command.prizeAmounts()) : null));
    }

    /**
     * Guarda lo que se lleva cada jugador, elegido al cerrar. A propósito no se comprueba que sume el bote:
     * se reparte en números redondos y lo que sobra se muestra aparte. Quien no aparece se lleva cero.
     */
    private static void setPayouts(PokerSession session, List<Payout> payouts) {
        var ids = payouts.stream().map(Payout::playerId).toList();
        var players = session.getEntries().stream().map(Entry::playerId).toList();
        if (ids.stream().distinct().count() != ids.size() || !players.containsAll(ids)) {
            throw BusinessException.badRequest("El reparto incluye jugadores que no están en el torneo");
        }
        session.setEntries(session.getEntries().stream().map(entry -> payouts.stream()
                .filter(payout -> payout.playerId() == entry.playerId()).findFirst()
                .map(payout -> entry.withPayout(payout.prizeCents(), payout.points().setScale(2, RoundingMode.DOWN)))
                .orElseGet(() -> entry.withPayout(0, BigDecimal.ZERO.setScale(2)))).toList());
    }

    /**
     * Corrige un torneo cerrado. Si el orden no cambia se conservan las fichas finales (y los empates);
     * si cambia, el orden enviado pasa a ser la clasificación y las fichas finales dejan de contar.
     * Si se piden quitar sin cambiar el orden, los que seguían en la mesa comparten el primer puesto.
     */
    static void editResults(PokerSession session, EditResults request) {
        List<Entry> entries = session.getEntries();
        List<Long> ids = request.standings().stream().map(ResultEdit::playerId).toList();
        if (ids.size() != entries.size() || ids.stream().distinct().count() != ids.size()
                || !entries.stream().map(Entry::playerId).toList().containsAll(ids)) {
            throw BusinessException.badRequest("La clasificación tiene que incluir a todos los jugadores del torneo");
        }
        Settings settings = session.getSettings();
        if (request.buyInCents() != null || request.rebuyCostCents() != null || request.addOnCostCents() != null) {
            settings = settings.withCosts(request.buyInCents() != null ? request.buyInCents() : settings.buyInCents(),
                    request.rebuyCostCents(), request.addOnCostCents());
            session.setSettings(settings);
        }
        for (ResultEdit edit : request.standings()) {
            if (!allowed(settings.rebuy(), edit.rebuys()) || !allowed(settings.addOn(), edit.addOns())) {
                throw BusinessException.badRequest("Hay más recompras o add-ons de los que permite el torneo");
            }
        }
        List<Long> current = view(session, 0).results().stream().map(Result::playerId).toList();
        boolean sameOrder = current.equals(ids);
        boolean keepChips = sameOrder && !Boolean.TRUE.equals(request.clearChips());
        session.setEntries(request.standings().stream().map(edit -> {
            Entry entry = entries.stream().filter(candidate -> candidate.playerId() == edit.playerId())
                    .findFirst().orElseThrow();
            Entry edited = entry.withExtras(edit.rebuys(), edit.addOns())
                    .withFinalChips(keepChips ? entry.finalChips() : null);
            // Quien corrige a mano el premio o los puntos manda sobre el reparto calculado.
            return edit.prizeCents() == null || edit.points() == null ? edited
                    : edited.withPayout(edit.prizeCents(), edit.points().setScale(2, RoundingMode.DOWN));
        }).toList());
        if (!sameOrder) {
            var eliminations = new ArrayList<>(ids.subList(1, ids.size()));
            java.util.Collections.reverse(eliminations);
            session.setEliminations(List.copyOf(eliminations));
        }
        session.setScheduledOn(request.date());
        boolean manual = request.standings().stream().allMatch(edit -> edit.prizeCents() != null && edit.points() != null);
        if (!manual) checkAmountsFit(session.getSettings().prizeAmounts(), pot(session));
    }

    private static boolean allowed(Extra extra, int count) {
        return count == 0 || extra != null && (extra.limit() == null || count <= extra.limit());
    }

    private static void checkAmountsFit(List<Long> amounts, long pot) {
        if (amounts != null && amounts.stream().mapToLong(Long::longValue).sum() > pot) {
            throw BusinessException.badRequest("Las cantidades del reparto superan el bote. Ajusta el reparto");
        }
    }

    private static long pot(PokerSession session) {
        return session.getEntries().stream().mapToLong(entry -> paid(entry, session.getSettings())).sum();
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
        session.setEntries(session.getEntries().stream().map(entry -> entry.withFinalChips(stacks.stream()
                .filter(stack -> stack.playerId() == entry.playerId())
                .map(FinalStack::chips).findFirst().orElse(0L))).toList());
    }

    private static void start(PokerSession session, long now) {
        if (session.getStartedAt() != null) throw BusinessException.conflict("El torneo ya ha empezado");
        int count = session.getEntries().size();
        if (count < 2) throw BusinessException.badRequest("Confirma al menos dos jugadores");
        if (count < session.getSettings().prizePlaces()) {
            throw BusinessException.badRequest("Hay más puestos premiados que jugadores. Ajusta el reparto");
        }
        long duration = duration(session.getSettings().levels().getFirst());
        // Empieza parado: la mesa se sienta con calma y el reloj arranca cuando alguien le da.
        session.setBlindClock(new BlindClock(0, null, duration));
        session.setStartedAt(now);
    }

    private static void eliminate(PokerSession session, Long playerId) {
        activeEntry(session, playerId);
        var order = new ArrayList<>(session.getEliminations());
        order.add(playerId);
        session.setEliminations(order);
    }

    /** Quita la eliminación de un jugador concreto; los demás conservan su orden. */
    private static void revive(PokerSession session, Long playerId) {
        if (!session.getEliminations().contains(playerId)) {
            throw BusinessException.conflict("Ese jugador no está eliminado");
        }
        session.setEliminations(session.getEliminations().stream()
                .filter(id -> !id.equals(playerId)).toList());
    }

    private static void extra(PokerSession session, Command command, BlindClock clock) {
        boolean rebuy = command.action() == Action.REBUY;
        boolean comeback = rebuy && command.playerId() != null
                && session.getEliminations().contains(command.playerId());
        Entry player = comeback
                ? session.getEntries().stream().filter(entry -> entry.playerId() == command.playerId())
                        .findFirst().orElseThrow()
                : activeEntry(session, command.playerId());
        Extra option = rebuy ? session.getSettings().rebuy() : session.getSettings().addOn();
        int count = rebuy ? player.rebuys() : player.addOns();
        if (option == null || (option.limit() != null && count >= option.limit()) || clock.level() >= buyUntil(session.getSettings().levels(), option.throughLevel())
                || clock.remainingMs() == 0) {
            throw BusinessException.conflict("Ese extra de fichas ya no está disponible para este jugador");
        }
        if (comeback) revive(session, player.playerId());
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

    /** Nivel en que se cierra un extra: su corte más los descansos que lo siguen, para comprar en la pausa. */
    static int buyUntil(List<BlindLevel> levels, int throughLevel) {
        int end = throughLevel;
        while (end < levels.size() && levels.get(end).big() == 0) end++;
        return end;
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

    /**
     * Premios por puesto. Con cantidades fijas, lo que sobra del bote se suma al primer puesto, igual que
     * los céntimos del reparto por porcentajes; así el bote siempre se reparte entero.
     */
    static List<Long> prizes(long pot, Settings settings) {
        if (settings.prizeAmounts() == null) return prizes(pot, settings.prizeShares());
        var prizes = new ArrayList<>(settings.prizeAmounts());
        long remainder = pot - prizes.stream().mapToLong(Long::longValue).sum();
        if (remainder > 0) prizes.set(0, prizes.getFirst() + remainder);
        return List.copyOf(prizes);
    }

    /**
     * Puntos de la liga por puesto, en centésimas: siempre se reparten 9. Con tres premios o más, 5-3-1;
     * con dos, 5-4; con uno, los 9 para el ganador.
     */
    static List<Long> pointsScale(int prizePlaces) {
        return switch (prizePlaces) {
            case 1 -> List.of(900L);
            case 2 -> List.of(500L, 400L);
            default -> List.of(500L, 300L, 100L);
        };
    }

    /** Puntos por puesto del torneo, en centésimas: los que eligió el organizador o la escala de siempre. */
    static List<Long> points(Settings settings) {
        if (settings.prizePoints() == null) return pointsScale(settings.prizePlaces());
        return settings.prizePoints().stream().limit(settings.prizePlaces()).map(points -> points * 100L).toList();
    }

    /** Lo que suman los puestos desde {@code place} para {@code count} empatados, partido entre ellos. */
    private static long share(List<Long> byPlace, int place, int count, int tiedIndex) {
        long total = byPlace.stream().skip(place - 1L).limit(count).mapToLong(Long::longValue).sum();
        return total / count + (tiedIndex < total % count ? 1 : 0);
    }

    static Session view(PokerSession session, long now) {
        Settings settings = session.getSettings();
        List<Entry> entries = session.getEntries();
        List<Long> order = session.getEliminations();
        long pot = pot(session);
        List<Long> prizes = prizes(pot, settings);
        List<Long> points = points(settings);
        List<Result> results = session.getClosedAt() == null ? List.of() : entries.stream()
                .map(entry -> {
                    int index = order.indexOf(entry.playerId());
                    int place = index < 0 ? 1 : entries.size() - index;
                    int tiedCount = 1;
                    int tiedIndex = 0;
                    if (index < 0 && entry.finalChips() != null) {
                        var survivors = entries.stream().filter(other -> !order.contains(other.playerId())).toList();
                        place = 1 + (int) survivors.stream().filter(other -> other.finalChips() > entry.finalChips()).count();
                        var tied = survivors.stream().filter(other -> other.finalChips().equals(entry.finalChips()))
                                .sorted(Comparator.comparingLong(Entry::playerId)).toList();
                        tiedCount = tied.size();
                        tiedIndex = tied.indexOf(entry);
                    }
                    long prize = entry.prizeCents() != null ? entry.prizeCents()
                            : share(prizes, place, tiedCount, tiedIndex);
                    BigDecimal earned = entry.points() != null ? entry.points()
                            : BigDecimal.valueOf(share(points, place, tiedCount, tiedIndex), 2);
                    return new Result(entry.playerId(), entry.name(), place, paid(entry, settings),
                            prize, entry.rebuys(), entry.addOns(), entry.finalChips(), earned);
                })
                .sorted(Comparator.comparingInt(Result::place)).toList();
        long leftover = results.isEmpty() ? 0 : pot - results.stream().mapToLong(Result::prizeCents).sum();
        return new Session(session.getId(), session.getRevision(), session.getScheduledOn(),
                session.getStartedAt(), session.getClosedAt(), settings, entries, order,
                clockAt(session.getBlindClock(), settings.levels(), now), pot, prizes, results, leftover);
    }
}
