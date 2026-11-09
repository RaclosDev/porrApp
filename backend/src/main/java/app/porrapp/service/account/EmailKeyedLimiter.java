package app.porrapp.service.account;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Cuenta sucesos por email en una ventana fija, en memoria (como {@code RateLimitingFilter}). Sirve
 * para limitar los intentos de contraseña por cuenta, además de por IP, y los correos por email.
 * Si se llena, se vacía entero: mejor perder la cuenta que quedarse sin memoria.
 */
final class EmailKeyedLimiter {

    private static final int MAX_TRACKED = 50_000;

    private record Window(Instant start, int count) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final int max;
    private final Duration window;
    private final Clock clock;

    EmailKeyedLimiter(int max, Duration window, Clock clock) {
        this.max = max;
        this.window = window;
        this.clock = clock;
    }

    /** Si ya se han contado {@code max} sucesos en la ventana actual. */
    boolean exhausted(String key) {
        Window current = windows.get(key);
        return current != null && !expired(current) && current.count() >= max;
    }

    /** Cuenta un suceso. */
    void record(String key) {
        if (windows.size() >= MAX_TRACKED && !windows.containsKey(key)) {
            windows.clear();
        }
        windows.compute(key, (k, current) -> current == null || expired(current)
                ? new Window(clock.instant(), 1)
                : new Window(current.start(), current.count() + 1));
    }

    /** Cuenta un suceso si queda hueco. Devuelve si lo había. */
    boolean tryRecord(String key) {
        boolean[] allowed = {false};
        if (windows.size() >= MAX_TRACKED && !windows.containsKey(key)) {
            windows.clear();
        }
        windows.compute(key, (k, current) -> {
            if (current == null || expired(current)) {
                allowed[0] = true;
                return new Window(clock.instant(), 1);
            }
            if (current.count() >= max) {
                return current;
            }
            allowed[0] = true;
            return new Window(current.start(), current.count() + 1);
        });
        return allowed[0];
    }

    void reset(String key) {
        windows.remove(key);
    }

    private boolean expired(Window current) {
        return !clock.instant().isBefore(current.start().plus(window));
    }
}
