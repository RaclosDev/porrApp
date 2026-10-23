package com.porra.mundial.sports;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Puerto de integracion con proveedores de datos deportivos (ESPN, Sportradar, API-Football).
 * Permite desacoplar el motor de sincronizacion de una API concreta.
 */
public interface SportsDataProvider {

    /**
     * Nombre identificativo del proveedor activo.
     */
    String getProviderName();

    /**
     * Recupera el listado de eventos y partidos para un rango de fechas dado.
     *
     * @param dateRange Rango en formato YYYYMMDD-YYYYMMDD.
     * @return Arbol JSON con los eventos del torneo.
     * @throws Exception Si la llamada de red falla o la respuesta no es valida.
     */
    JsonNode fetchScoreboardEvents(String dateRange) throws Exception;
}
