package com.porra.mundial.dto;

/**
 * Probabilidades de un equipo, usadas para ordenar el cuadro antes de que empiece el torneo.
 *
 * @param name     nombre del equipo
 * @param win      cuota de ganar su grupo
 * @param qualify  cuota de pasar de ronda
 * @param outright cuota de ganar el torneo
 */
public record TeamOddsDTO(String name, Double win, Double qualify, Double outright) {
}
