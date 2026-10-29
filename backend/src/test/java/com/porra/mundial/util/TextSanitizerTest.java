package com.porra.mundial.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TextSanitizerTest {

    @Test
    @DisplayName("fixMojibake corrige correctamente caracteres UTF-8 doble codificados")
    void fixMojibake_CorrectsDoubleEncodedUtf8() {
        assertEquals("España", TextSanitizer.fixMojibake("EspaÃ±a"));
        assertEquals("México", TextSanitizer.fixMojibake("MÃ©xico"));
        assertEquals("Anónimo", TextSanitizer.fixMojibake("AnÃ³nimo"));
        assertEquals("Raúl", TextSanitizer.fixMojibake("RaÃºl"));
        assertEquals("José", TextSanitizer.fixMojibake("JosÃ©"));
        assertEquals("Adrián", TextSanitizer.fixMojibake("AdriÃ¡n"));
        assertEquals("Ángel", TextSanitizer.fixMojibake("Ã\u0081ngel"));
    }

    @Test
    @DisplayName("fixParticipantName corrige nombres propios con mojibake o ??")
    void fixParticipantName_CorrectsCorruptedParticipants() {
        assertEquals("Anónimo", TextSanitizer.fixParticipantName("An??nimo"));
        assertEquals("Anónimo", TextSanitizer.fixParticipantName("AnÃ³nimo"));
        assertEquals("Raúl", TextSanitizer.fixParticipantName("Ra??l"));
        assertEquals("José", TextSanitizer.fixParticipantName("Jos??"));
        assertEquals("Adrián", TextSanitizer.fixParticipantName("Adri??n"));
        assertEquals("Ángel", TextSanitizer.fixParticipantName("??ngel"));
        assertEquals("Iñaki", TextSanitizer.fixParticipantName("I??aki"));
        assertEquals("Peña", TextSanitizer.fixParticipantName("Pe??a"));
    }

    @Test
    @DisplayName("fixBracketDataJson corrige todo el contenido de un JSON de predicciones")
    void fixBracketDataJson_SanitizesEntireJson() {
        String corruptedJson = "{\"user\":\"An??nimo\",\"groups\":{\"H\":[\"Espa??a\",\"Uruguay\"]}}";
        String expected = "{\"user\":\"Anónimo\",\"groups\":{\"H\":[\"España\",\"Uruguay\"]}}";
        assertEquals(expected, TextSanitizer.fixBracketDataJson(corruptedJson));
    }
}
