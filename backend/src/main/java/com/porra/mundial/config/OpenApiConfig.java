package com.porra.mundial.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.Contact;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Porra Mundial API")
                        .version("1.0.0")
                        .description("API REST para la Porra Mundial. Desarrollado con Spring Boot 3.")
                        .contact(new Contact()
                                .name("RaclosDev")
                                .url("https://loopdeck.raclos.es")));
    }
}
