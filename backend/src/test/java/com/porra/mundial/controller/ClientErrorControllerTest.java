package com.porra.mundial.controller;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ClientErrorControllerTest {

    private final ClientErrorController controller = new ClientErrorController();

    @Test
    void answersNoContent() {
        var response = controller.report(new ClientErrorController.ClientErrorReport(
                "error", "boom", "at x", "/ligas/3?code=SECRET"));

        assertThat(response.getStatusCode().value()).isEqualTo(204);
    }

    @Test
    void cleanRemovesEmailsControlCharactersAndLineBreaks() {
        String cleaned = ClientErrorController.clean("fallo de ana@example.com\r\nINFO falso\u0007", 500, false);

        assertThat(cleaned).isEqualTo("fallo de [email]  INFO falso");
        assertThat(cleaned).doesNotContain("\n", "\r", "@");
    }

    @Test
    void cleanTruncatesLongValuesAndMarksStackLines() {
        assertThat(ClientErrorController.clean("a".repeat(600), 500, false)).hasSize(501).endsWith("…");
        assertThat(ClientErrorController.clean("uno\ndos", 100, true)).isEqualTo("uno ⏎ dos");
        assertThat(ClientErrorController.clean(null, 100, false)).isEqualTo("-");
    }
}
