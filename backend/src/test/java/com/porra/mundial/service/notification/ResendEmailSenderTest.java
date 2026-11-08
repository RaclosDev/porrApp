package com.porra.mundial.service.notification;

import com.porra.mundial.service.notification.EmailSender.Email;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.net.http.HttpClient;

import static org.assertj.core.api.Assertions.assertThat;

/** Cuerpo que se manda a Resend y qué pasa sin clave. */
class ResendEmailSenderTest {

    private final ObjectMapper mapper = JsonMapper.builder().build();
    private final Email email = new Email("ana@test.com", "Asunto", "Texto", "<p>Texto</p>");

    @Test
    void theBodyHasSenderRecipientAndBothVersions() {
        ResendEmailSender sender = new ResendEmailSender("re_clave", "PorrApp <hola@porrapp.app>", mapper,
                HttpClient.newHttpClient());

        JsonNode body = mapper.readTree(sender.body(email));

        assertThat(sender.enabled()).isTrue();
        assertThat(body.get("from").asString()).isEqualTo("PorrApp <hola@porrapp.app>");
        assertThat(body.get("to").get(0).asString()).isEqualTo("ana@test.com");
        assertThat(body.get("subject").asString()).isEqualTo("Asunto");
        assertThat(body.get("text").asString()).isEqualTo("Texto");
        assertThat(body.get("html").asString()).isEqualTo("<p>Texto</p>");
    }

    @Test
    void withoutAKeyItIsOffAndSendsNothing() {
        ResendEmailSender sender = new ResendEmailSender("  ", "PorrApp <hola@porrapp.app>", mapper, null);

        assertThat(sender.enabled()).isFalse();
        sender.send(email); // Sin cliente HTTP: fallaría si intentara mandarlo.
    }

    @Test
    void theEmailContentIsNotLogged() {
        assertThat(email.toString()).doesNotContain("Texto").contains("Asunto");
    }
}
