package com.porra.mundial.service.account;

import com.porra.mundial.service.notification.EmailSender.Email;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Contenido del correo para cambiar la contraseña. */
class PasswordResetEmailTest {

    private static final String LINK = "https://porrapp.app/restablecer-contrasena#token=abc_123";

    private final Email email = PasswordResetEmail.build("ana@test.com", "Ana <b>&", LINK, "https://porrapp.app");

    @Test
    void itGoesToTheAccountWithTheLinkInBothVersions() {
        assertThat(email.to()).isEqualTo("ana@test.com");
        assertThat(email.subject()).isEqualTo("Cambia tu contraseña de PorrApp");
        assertThat(email.text()).contains(LINK).contains("Hola, Ana <b>&:");
        assertThat(email.html()).contains("href=\"" + LINK + "\"").contains("Cambiar mi contraseña");
    }

    @Test
    void theHtmlHasTheLogoAndEscapesTheName() {
        assertThat(email.html())
                .contains("<meta charset=\"utf-8\">")
                .contains("src=\"https://porrapp.app/icon-paper-192.png\"")
                .contains("Hola, Ana &lt;b&gt;&amp;:")
                .doesNotContain("<b>&:");
    }
}
