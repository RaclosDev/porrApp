package app.porrapp.util;

import app.porrapp.exception.BusinessException;

import java.security.SecureRandom;
import java.util.function.Predicate;

/**
 * Códigos de invitación de liga: 10 caracteres de un alfabeto base32 sin I, O, 0 ni 1 (50 bits),
 * generados con {@link SecureRandom}. Los códigos antiguos de 6 caracteres siguen siendo válidos:
 * la búsqueda es por igualdad y no depende del formato.
 */
public final class JoinCodeGenerator {

    static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    public static final int LENGTH = 10;

    private static final SecureRandom RANDOM = new SecureRandom();

    private JoinCodeGenerator() {
    }

    private static final int MAX_ATTEMPTS = 10;

    /**
     * Un código que no use ya otra liga. Tras {@value #MAX_ATTEMPTS} choques seguidos (casi imposible con
     * 50 bits) responde con un conflicto que el cliente puede reintentar, no con un error 500.
     */
    public static String unique(Predicate<String> taken) {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            String code = next();
            if (!taken.test(code)) return code;
        }
        throw BusinessException.conflict("No se pudo generar el código de invitación, inténtalo de nuevo");
    }

    public static String next() {
        char[] code = new char[LENGTH];
        for (int i = 0; i < LENGTH; i++) {
            code[i] = ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length()));
        }
        return new String(code);
    }
}
