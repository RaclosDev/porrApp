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
    @DisplayName("fixTeamName corrige países corruptos con mojibake, ?? o sustitutos")
    void fixTeamName_CorrectsCorruptedCountries() {
        assertEquals("España", TextSanitizer.fixTeamName("Espa??a"));
        assertEquals("España", TextSanitizer.fixTeamName("Espa?a"));
        assertEquals("España", TextSanitizer.fixTeamName("Espaa"));
        assertEquals("España", TextSanitizer.fixTeamName("EspaÃ±a"));
        assertEquals("México", TextSanitizer.fixTeamName("M??xico"));
        assertEquals("Canadá", TextSanitizer.fixTeamName("Canad??"));
        assertEquals("Sudáfrica", TextSanitizer.fixTeamName("Sud??frica"));
        assertEquals("Países Bajos", TextSanitizer.fixTeamName("Pa??ses Bajos"));
        assertEquals("Japón", TextSanitizer.fixTeamName("Jap??n"));
        assertEquals("Curaçao", TextSanitizer.fixTeamName("Cura??ao"));
        assertEquals("Arabia Saudí", TextSanitizer.fixTeamName("Arabia Saud??"));
        assertEquals("Atlético de Madrid", TextSanitizer.fixTeamName("Atl??tico de Madrid"));
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
