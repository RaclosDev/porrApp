package com.porra.mundial.service;

import com.porra.mundial.model.PoolFormat;

/**
 * Datos para crear una liga: o una competición existente ({@code competitionId}) o una nueva
 * personalizada ({@code customCompetitionName}).
 *
 * @param pichichi     si la liga puntúa al máximo goleador; sin indicarlo, sí (las personalizadas nunca)
 * @param creationKey  clave de idempotencia: repetir la creación con la misma devuelve la misma liga
 */
public record NewLeague(String name, String adminEmail, Long competitionId, PoolFormat poolFormat,
                        Boolean pichichi, String customCompetitionName, String creationKey) {

    /** Liga sobre una competición existente, con goleador y sin clave de idempotencia. */
    public static NewLeague of(String name, String adminEmail, Long competitionId, PoolFormat poolFormat) {
        return new NewLeague(name, adminEmail, competitionId, poolFormat, null, null, null);
    }

    /** Liga con una competición personalizada nueva. */
    public static NewLeague custom(String name, String adminEmail, String competitionName, PoolFormat poolFormat) {
        return new NewLeague(name, adminEmail, null, poolFormat, null, competitionName, null);
    }

    public NewLeague withPichichi(boolean value) {
        return new NewLeague(name, adminEmail, competitionId, poolFormat, value, customCompetitionName, creationKey);
    }

    public NewLeague withCreationKey(String key) {
        return new NewLeague(name, adminEmail, competitionId, poolFormat, pichichi, customCompetitionName, key);
    }

    boolean countsScorers() {
        return pichichi == null || pichichi;
    }
}
