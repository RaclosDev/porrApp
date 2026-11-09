package app.porrapp.service.account;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;

/**
 * Como mucho un correo de la cuenta (código de registro, «ya tienes cuenta», «entra con Google») por
 * email y minuto, para que nadie pueda llenarle el buzón a otro. Además del límite por IP.
 */
@Component
class AccountEmailThrottle {

    static final Duration INTERVAL = Duration.ofMinutes(1);

    private final EmailKeyedLimiter limiter = new EmailKeyedLimiter(1, INTERVAL, Clock.systemUTC());

    /** Si se puede mandar ya un correo a este email; si sí, cuenta como mandado. */
    boolean tryAcquire(String email) {
        return limiter.tryRecord(email);
    }
}
