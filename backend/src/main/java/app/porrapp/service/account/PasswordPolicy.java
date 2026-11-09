package app.porrapp.service.account;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Qué contraseñas nuevas se aceptan: de {@link #MIN_LENGTH} caracteres a {@link #MAX_BYTES} bytes, y
 * ninguna de las más usadas ni el propio email. Sin reglas de mayúsculas o símbolos: según NIST
 * SP 800-63B, la longitud y descartar las conocidas protegen más y molestan menos.
 */
final class PasswordPolicy {

    static final int MIN_LENGTH = 8;
    /** BCrypt solo usa los primeros 72 bytes: más largas se rechazan en vez de recortarlas sin avisar. */
    static final int MAX_BYTES = 72;

    private static final Set<String> COMMON = load();

    private PasswordPolicy() {
    }

    /** 400 con el motivo si la contraseña no vale. @param email de la cuenta, o {@code null} */
    static void validate(String password, String email) {
        if (password == null || password.length() < MIN_LENGTH) {
            throw invalid("La contraseña debe tener al menos " + MIN_LENGTH + " caracteres.");
        }
        if (tooLong(password)) {
            throw invalid("La contraseña es demasiado larga.");
        }
        String lower = password.toLowerCase(Locale.ROOT);
        if (COMMON.contains(lower) || lower.chars().distinct().count() == 1) {
            throw invalid("Esa contraseña es de las más usadas y fácil de adivinar. Elige otra.");
        }
        if (email != null) {
            String local = email.toLowerCase(Locale.ROOT).split("@", 2)[0];
            if (lower.equals(email.toLowerCase(Locale.ROOT)) || lower.equals(local)) {
                throw invalid("La contraseña no puede ser tu email.");
            }
        }
    }

    static boolean tooLong(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES;
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static Set<String> load() {
        try (InputStream in = PasswordPolicy.class.getResourceAsStream("/common-passwords.txt")) {
            if (in == null) {
                throw new IllegalStateException("Falta common-passwords.txt");
            }
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                return reader.lines()
                        .map(String::trim)
                        .filter(line -> !line.isEmpty() && !line.startsWith("#"))
                        .map(line -> line.toLowerCase(Locale.ROOT))
                        .collect(Collectors.toUnmodifiableSet());
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
