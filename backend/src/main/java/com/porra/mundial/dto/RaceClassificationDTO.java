package com.porra.mundial.dto;

import java.util.List;

/**
 * Clasificación completa de una carrera de Fórmula 1.
 *
 * @param available false si la carrera no ha acabado o ESPN aún no la ha publicado
 * @param rows      pilotos del primero al último
 */
public record RaceClassificationDTO(boolean available, List<Row> rows) {

    public static final RaceClassificationDTO NONE = new RaceClassificationDTO(false, List.of());

    /**
     * @param driverId   id en {@code race_drivers}, o null si el piloto no está guardado
     * @param grid       puesto de salida
     * @param laps       vueltas completadas
     * @param time       tiempo total del ganador
     * @param gap        diferencia con el ganador («+0.799») de quien acaba en su misma vuelta
     * @param lapsBehind vueltas perdidas con el ganador de quien acaba doblado
     * @param status     FINISHED, RETIRED, DISQUALIFIED, DID_NOT_START u OTHER
     * @param points     puntos del Mundial en la carrera
     * @param fastestLap hizo la vuelta rápida
     */
    public record Row(int position, Long driverId, String name, String team, String teamColor, String number,
                      Integer grid, Integer laps, String time, String gap, Integer lapsBehind, String status,
                      Integer points, boolean fastestLap) {}
}
