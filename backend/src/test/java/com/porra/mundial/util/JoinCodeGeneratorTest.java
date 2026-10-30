package com.porra.mundial.util;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JoinCodeGeneratorTest {

    @Test
    void generatesTenCharacterCodesWithoutAmbiguousCharacters() {
        assertEquals(32, JoinCodeGenerator.ALPHABET.length(), "base32");
        assertEquals(32, JoinCodeGenerator.ALPHABET.chars().distinct().count());

        Set<String> codes = new HashSet<>();
        for (int i = 0; i < 2000; i++) {
            String code = JoinCodeGenerator.next();
            assertEquals(JoinCodeGenerator.LENGTH, code.length());
            assertTrue(code.matches("[A-HJ-NP-Z2-9]{10}"), code);
            codes.add(code);
        }
        assertEquals(2000, codes.size(), "50 bits: no debería repetirse ninguno en 2000");
    }
}
