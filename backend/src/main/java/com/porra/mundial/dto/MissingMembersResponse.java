package com.porra.mundial.dto;

import java.util.List;

/**
 * Miembros de una liga que aún no han pronosticado todos los partidos de una jornada.
 *
 * @param round        jornada consultada (vacía si la liga no tiene partidos)
 * @param totalMembers miembros de la liga
 * @param missingCount miembros con algún partido sin pronosticar
 * @param missingUsers esos miembros
 */
public record MissingMembersResponse(String round, int totalMembers, int missingCount, List<MissingUserNudgeDTO> missingUsers) {

    public static MissingMembersResponse empty() {
        return new MissingMembersResponse("", 0, 0, List.of());
    }
}
