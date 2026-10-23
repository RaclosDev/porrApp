package com.porra.mundial.sports;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Puerto de integración con proveedores de datos deportivos (ESPN, API-Football, Sportmonks).
 * Permite desacoplar el motor de sincronización de una API concreta.
 */
public interface SportsDataProvider {

    /**
     * Nombre identificativo del proveedor activo (ej. "ESPN", "API-Football").
     */
    String getProviderName();

    /**
     * Comprueba si este proveedor soporta la competición indicada.
     */
    boolean supports(String competitionCode);

    /**
     * Recupera el listado de eventos y partidos para un rango de fechas o temporada.
     *
     * @param dateRange Rango en formato YYYYMMDD-YYYYMMDD.
     * @return Árbol JSON con los eventos del torneo.
     * @throws Exception Si la llamada de red falla o la respuesta no es válida.
     */
    JsonNode fetchScoreboardEvents(String dateRange) throws Exception;
}
