package com.porra.mundial.dto;

import java.util.List;

/**
 * Mundial de Fórmula 1 según ESPN.
 *
 * @param season       temporada, por ejemplo «2026»
 * @param drivers      pilotos, del primero al último
 * @param constructors escuderías, de la primera a la última
 */
public record FormulaOneStandingsDTO(String season, List<DriverRow> drivers, List<ConstructorRow> constructors) {

    /** @param team escudería de su última carrera, si se conoce */
    public record DriverRow(int rank, String name, String shortName, String abbreviation, String country,
                            String flagUrl, String team, String teamColor, int points) {}

    public record ConstructorRow(int rank, String name, String color, int points) {}
}
