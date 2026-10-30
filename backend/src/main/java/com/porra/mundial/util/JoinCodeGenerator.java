package com.porra.mundial.util;

import java.security.SecureRandom;

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

    public static String next() {
        char[] code = new char[LENGTH];
        for (int i = 0; i < LENGTH; i++) {
            code[i] = ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length()));
        }
        return new String(code);
    }
}
