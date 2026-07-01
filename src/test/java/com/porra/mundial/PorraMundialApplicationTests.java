package com.porra.mundial;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
@Disabled("Requires a running PostgreSQL database")
class PorraMundialApplicationTests {

    @Test
    void contextLoads() {
        // Verifies Spring context starts without errors
    }
}
