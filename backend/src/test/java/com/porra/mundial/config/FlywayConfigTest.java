package com.porra.mundial.config;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.ErrorCode;
import org.flywaydb.core.api.ErrorDetails;
import org.flywaydb.core.api.output.ValidateOutput;
import org.flywaydb.core.api.output.ValidateResult;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.Mockito.*;

class FlywayConfigTest {

    private static ValidateOutput problem(String version, ErrorCode code) {
        return new ValidateOutput(version, "desc", "V" + version + ".sql", new ErrorDetails(code, "msg"));
    }

    private static Flyway flywayWith(ValidateOutput... problems) {
        Flyway flyway = mock(Flyway.class);
        when(flyway.validateWithResult()).thenReturn(new ValidateResult(
                "10.10.0", "db", null, problems.length == 0, 42, List.of(problems), List.of()));
        return flyway;
    }

    private static void runStrategy(Flyway flyway) {
        new FlywayConfig().flywayMigrationStrategy().migrate(flyway);
    }

    @Test
    void repairsOnlyTheKnownV38ChecksumDrift() {
        Flyway flyway = flywayWith(problem("38", ErrorCode.CHECKSUM_MISMATCH),
                problem("42", ErrorCode.RESOLVED_VERSIONED_MIGRATION_NOT_APPLIED));
        runStrategy(flyway);
        verify(flyway).repair();
        verify(flyway).migrate();
    }

    @Test
    void doesNotRepairOtherEditedMigrations() {
        Flyway flyway = flywayWith(problem("38", ErrorCode.CHECKSUM_MISMATCH), problem("37", ErrorCode.CHECKSUM_MISMATCH));
        runStrategy(flyway);
        verify(flyway, never()).repair();
        verify(flyway).migrate();
    }

    @Test
    void doesNotRepairWhenOnlyPendingMigrations() {
        Flyway flyway = flywayWith(problem("42", ErrorCode.RESOLVED_VERSIONED_MIGRATION_NOT_APPLIED));
        runStrategy(flyway);
        verify(flyway, never()).repair();
        verify(flyway).migrate();
    }
}
