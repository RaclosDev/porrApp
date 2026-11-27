package app.porrapp.config;

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
                        .title("PorrApp API")
                        .version("1.0.0")
                        .description("API REST de PorrApp, con Spring Boot 4.")
                        .contact(new Contact()
                                .name("RaclosDev")
                                .url("https://porrapp.app")));
    }
}
