package app.porrapp.model;

/**
 * Reglamento con el que se desempata la fase de grupos de un torneo: el de su organizador.
 * <p>
 * Dentro de un grupo los dos coinciden: desde el Mundial de 2026 la FIFA también mira primero los
 * enfrentamientos directos y solo después la diferencia de goles general. Cambian la escala de las
 * tarjetas y el orden entre los mejores terceros.
 */
public enum GroupTiebreak {

    /** Artículo 13 del reglamento de la Copa Mundial de la FIFA 26: la roja directa resta 4. */
    FIFA(-4, false),

    /**
     * Artículo 20 del reglamento de la Eurocopa 2022-24: toda roja resta 3, sea directa o por doble
     * amarilla, y entre terceros cuentan las victorias antes que las tarjetas.
     */
    UEFA(-3, true);

    private final int directRedCard;
    private final boolean winsRankThirds;

    GroupTiebreak(int directRedCard, boolean winsRankThirds) {
        this.directRedCard = directRedCard;
        this.winsRankThirds = winsRankThirds;
    }

    /**
     * Puntos de conducta que resta una roja directa. La amarilla resta 1 y la segunda amarilla del
     * mismo jugador otros 2 en los dos reglamentos.
     */
    public int directRedCard() {
        return directRedCard;
    }

    /** Entre los mejores terceros, las victorias desempatan después de los goles y antes de las tarjetas. */
    public boolean winsRankThirds() {
        return winsRankThirds;
    }
}
