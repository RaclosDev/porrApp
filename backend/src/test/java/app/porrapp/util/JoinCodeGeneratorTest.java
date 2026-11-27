package app.porrapp.util;

import app.porrapp.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
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

    @Test
    void uniqueRetriesWhenACodeIsAlreadyTaken() {
        AtomicInteger calls = new AtomicInteger();
        String code = JoinCodeGenerator.unique(candidate -> calls.incrementAndGet() <= 2);

        assertEquals(3, calls.get());
        assertEquals(JoinCodeGenerator.LENGTH, code.length());
    }

    @Test
    void uniqueGivesARetryableConflictInsteadOfAServerErrorWhenEveryCodeIsTaken() {
        BusinessException error = assertThrows(BusinessException.class, () -> JoinCodeGenerator.unique(candidate -> true));

        assertEquals(HttpStatus.CONFLICT, error.getStatus());
    }
}
