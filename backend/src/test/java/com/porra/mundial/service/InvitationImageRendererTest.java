package com.porra.mundial.service;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class InvitationImageRendererTest {

    @Test
    void unavailableInvitationFontFailsWithGenericServerErrorWithoutItsPath() {
        String internalPath = "fonts/internal/private.ttf";

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class, () -> InvitationImageRenderer.loadFont(internalPath));

        assertThat(error.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(error.getReason()).isEqualTo("No se pudo generar la imagen de invitación.");
        assertThat(error.getReason()).doesNotContain(internalPath);
        assertThat(error.getCause()).isNotNull();
    }

    @Test
    void genericCardIsDrawnOnce() {
        InvitationImageRenderer renderer = new InvitationImageRenderer("https://porra.raclos.es");
        assertThat(renderer.generic()).isSameAs(renderer.generic());
    }
}
