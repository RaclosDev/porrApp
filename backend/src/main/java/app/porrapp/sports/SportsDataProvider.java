package app.porrapp.sports;

import tools.jackson.databind.JsonNode;

import java.util.Collections;
import java.util.List;

/**
 * Puerto de integración con proveedores de datos deportivos (ESPN).
 * Permite desacoplar el motor de sincronización de una API concreta.
 */
public interface SportsDataProvider {

    /**
     * Nombre identificativo del proveedor activo (ej. "ESPN").
     */
    String getProviderName();

    /**
     * Comprueba si este proveedor soporta la competición indicada.
     */
    boolean supports(String competitionCode);

    /**
     * Si se le puede llamar ahora. Un proveedor con el circuit breaker abierto tras fallos repetidos
     * no llama a la API; los fallos de una petición se propagan, no equivalen a un calendario vacío.
     */
    default boolean isAvailable() {
        return true;
    }

    /**
     * Recupera el listado de eventos de una competición: siempre se dice cuál, ninguna va por defecto.
     *
     * @param competitionSlug Slug o código oficial (ej. "esp.1", "uefa.champions", "fifa.world").
     * @param dateRange       Fecha o rango opcional.
     * @return Árbol JSON con los eventos.
     */
    JsonNode fetchScoreboardEvents(String competitionSlug, String dateRange) throws Exception;

    /** Evento concreto, independiente del calendario de la temporada. */
    default JsonNode fetchEvent(String competitionSlug, String eventId) throws Exception {
        throw new UnsupportedOperationException("El proveedor no ofrece consultas por evento");
    }

    /**
     * Recupera los equipos participantes en una competición con sus escudos oficiales y nombres.
     *
     * @param competitionSlug Slug de la competición (ej. "esp.1").
     * @return Árbol JSON con los equipos o null si no está implementado.
     */
    default JsonNode fetchTeams(String competitionSlug) throws Exception {
        return null;
    }

    /**
     * Recupera las clasificaciones oficiales de una competición.
     *
     * @param competitionSlug Slug de la competición.
     * @return Árbol JSON con la clasificación o null.
     */
    default JsonNode fetchStandings(String competitionSlug) throws Exception {
        return null;
    }

    /**
     * Recupera la lista de fechas oficiales de partidos de la temporada.
     *
     * @param competitionSlug Slug de la competición.
     * @return Lista de strings en formato ISO (ej. "2026-10-24T12:00Z").
     */
    default List<String> fetchSeasonCalendarDates(String competitionSlug) throws Exception {
        return Collections.emptyList();
    }

    /**
     * Inicio y fin de la temporada en curso según el proveedor, en ISO (ej. "2026-06-05T04:00Z").
     *
     * @return null si el proveedor no lo sabe
     */
    default SeasonWindow fetchSeasonWindow(String competitionSlug) throws Exception {
        return null;
    }

    /**
     * Fechas de inicio y fin de una temporada tal como las da el proveedor. {@code start} y {@code end}
     * acotan lo que se importa; {@code seasonStart} es cuándo empieza de verdad la temporada si lo importado
     * arranca antes (los playoffs de la NBA traen también los anteriores), o null si no se sabe.
     */
    record SeasonWindow(String start, String end, String seasonStart) {
        public SeasonWindow(String start, String end) {
            this(start, end, start);
        }
    }
}
