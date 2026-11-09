package app.porrapp.model;

/**
 * Id externo de un equipo: el que le da su proveedor con el prefijo de su deporte, para que el mismo
 * número en dos deportes o dos proveedores nunca sea el mismo equipo. La NBA ({@code nba-}), la NFL
 * ({@code nfl:}), el LoL ({@code lol-}), el tenis ({@code tennis-}) y la UFC ({@code ufc-a}) ya llegan con
 * el suyo desde su proveedor; el fútbol de ESPN llega con el número a secas y lo recibe aquí.
 */
public final class TeamExternalIds {

    /** Prefijo de los equipos de fútbol de ESPN. */
    public static final String SOCCER_PREFIX = "soccer-";

    private TeamExternalIds() {
    }

    /** Id con el que se guarda el equipo que el proveedor de {@code competition} llama {@code providerId}. */
    public static String of(Competition competition, String providerId) {
        if (providerId == null || providerId.isBlank()) return null;
        String id = providerId.trim();
        boolean football = competition == null || Sport.ofExternalId(competition.getExternalId()) == Sport.FOOTBALL;
        return football && id.matches("[0-9]+") ? SOCCER_PREFIX + id : id;
    }

    /**
     * Id sin prefijo con el que se guardaba un equipo de fútbol, o null si {@code externalId} no es de fútbol.
     * Solo sirve para reconocer equipos guardados antes del prefijo.
     */
    public static String legacy(String externalId) {
        return externalId != null && externalId.startsWith(SOCCER_PREFIX)
                ? externalId.substring(SOCCER_PREFIX.length()) : null;
    }
}
