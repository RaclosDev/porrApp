package app.porrapp.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;

/** Claves aleatorias que hacen no adivinable la URL de una imagen. */
public final class ImageKeys {

    private static final SecureRandom RANDOM = new SecureRandom();

    private ImageKeys() {
    }

    /** 128 bits aleatorios en hexadecimal (32 caracteres). */
    public static String newKey() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    /** Compara en tiempo constante; una clave vacía o ausente nunca coincide. */
    public static boolean matches(String expected, String given) {
        if (expected == null || expected.isEmpty() || given == null) return false;
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), given.getBytes(StandardCharsets.UTF_8));
    }
}
