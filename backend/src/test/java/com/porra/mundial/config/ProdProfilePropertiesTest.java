package com.porra.mundial.config;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/** Con el perfil prod no se publica Swagger y CORS solo admite el dominio oficial. */
class ProdProfilePropertiesTest {

    @Configuration
    static class NoBeans {
    }

    @Nested
    @SpringBootTest(classes = NoBeans.class, webEnvironment = SpringBootTest.WebEnvironment.NONE)
    @ActiveProfiles("prod")
    class Prod {
        @Autowired
        Environment env;

        @Test
        void disablesApiDocsAndRestrictsCors() {
            assertThat(env.getProperty("springdoc.api-docs.enabled")).isEqualTo("false");
            assertThat(env.getProperty("springdoc.swagger-ui.enabled")).isEqualTo("false");
            if (System.getenv("CORS_ALLOWED_ORIGINS") == null) {
                assertThat(env.getProperty("app.cors.allowed-origins")).isEqualTo("https://porra.raclos.es");
            }
        }
    }

    @Nested
    @SpringBootTest(classes = NoBeans.class, webEnvironment = SpringBootTest.WebEnvironment.NONE)
    class Dev {
        @Autowired
        Environment env;

        @Test
        void keepsApiDocsOutsideProd() {
            assertThat(env.getProperty("springdoc.api-docs.enabled")).isNull();
        }
    }
}
