package com.porra.mundial;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Arranca la aplicación entera con el application.properties real (el de src/test/resources
 * lo sustituye en el resto de tests) contra un Postgres de verdad, como en producción.
 * Detecta propiedades que ya no existen, beans que faltan y migraciones que no aplican.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(
        locations = "file:src/main/resources/application.properties",
        properties = "app.jwt.secret=context-test-secret-0123456789-abcdefghijklmnopqrstuvwxyz")
@Testcontainers(disabledWithoutDocker = true)
class PorraMundialApplicationTests {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final HttpClient HTTP = HttpClient.newHttpClient();

    @LocalServerPort
    private int port;

    private HttpResponse<String> get(String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build();
        return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void startsAndAnswersTheLivenessProbe() throws Exception {
        HttpResponse<String> response = get("/actuator/health/liveness");

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("UP");
    }

    @Test
    void servesPublicJsonWithIsoDates() throws Exception {
        HttpResponse<String> response = get("/api/matches?competitionId=2");

        assertThat(response.statusCode()).isEqualTo(200);
        // Las fechas tienen que salir como texto ISO, no como números ni arrays.
        assertThat(response.body()).containsPattern("\"date\":\"\\d{4}-\\d{2}-\\d{2}T");
    }
}
