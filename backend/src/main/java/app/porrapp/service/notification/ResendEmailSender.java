package app.porrapp.service.notification;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

/**
 * Envía los correos con la API de Resend (https://resend.com). Sin {@code RESEND_API_KEY} queda
 * desactivado y no se puede recuperar la contraseña.
 */
@Component
@Slf4j
public class ResendEmailSender implements EmailSender {

    private static final URI ENDPOINT = URI.create("https://api.resend.com/emails");

    private final String apiKey;
    private final String from;
    private final ObjectMapper objectMapper;
    private final HttpClient client;

    @Autowired
    public ResendEmailSender(@Value("${resend.api-key:}") String apiKey,
                             @Value("${mail.from:PorrApp <hola@porrapp.app>}") String from,
                             ObjectMapper objectMapper) {
        this(apiKey, from, objectMapper, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
    }

    ResendEmailSender(String apiKey, String from, ObjectMapper objectMapper, HttpClient client) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.from = from;
        this.objectMapper = objectMapper;
        this.client = client;
    }

    @Override
    public boolean enabled() {
        return !apiKey.isEmpty();
    }

    @Override
    public void send(Email email) {
        if (!enabled()) {
            log.warn("No hay RESEND_API_KEY: no se manda el correo «{}».", email.subject());
            return;
        }
        HttpRequest request = HttpRequest.newBuilder(ENDPOINT)
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json; charset=utf-8")
                .POST(HttpRequest.BodyPublishers.ofString(body(email), StandardCharsets.UTF_8))
                .build();
        client.sendAsync(request, HttpResponse.BodyHandlers.ofString()).whenComplete((response, error) -> {
            if (error != null) {
                log.warn("No se pudo mandar el correo «{}»: {}", email.subject(), error.getMessage());
            } else if (response.statusCode() / 100 != 2) {
                log.warn("Resend rechazó el correo «{}»: {} {}", email.subject(), response.statusCode(), response.body());
            }
        });
    }

    String body(Email email) {
        return objectMapper.writeValueAsString(Map.of(
                "from", from,
                "to", new String[] {email.to()},
                "subject", email.subject(),
                "text", email.text(),
                "html", email.html()));
    }
}
