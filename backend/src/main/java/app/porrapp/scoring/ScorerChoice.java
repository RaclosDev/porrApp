package app.porrapp.scoring;

import app.porrapp.dto.PredictionDataDTO;
import app.porrapp.model.Edition;
import app.porrapp.model.Prediction;
import app.porrapp.model.ScorerPick;

/**
 * Pichichi de una porra.
 *
 * @param written    lo que escribió o eligió el participante
 * @param playerId   id en el proveedor del jugador al que se refiere, si se sabe; null o vacío si no
 * @param playerName nombre de ese jugador; null si no se sabe a quién se refiere (se empareja por lo escrito)
 * @param byAdmin    el jugador lo asignó el administrador de la liga
 */
public record ScorerChoice(String written, String playerId, String playerName, boolean byAdmin) {

    /** Solo lo escrito: se emparejará con un goleador por el nombre. */
    public static ScorerChoice written(String written) {
        return new ScorerChoice(written, null, null, false);
    }

    /** El pichichi que va dentro de un cuadro: el nombre y, si se eligió de la lista, su jugador. */
    public static ScorerChoice of(PredictionDataDTO bracket) {
        if (bracket == null) return written(null);
        String playerId = bracket.getScorerPlayerId();
        return playerId == null || playerId.isBlank()
                ? written(bracket.getScorer())
                : new ScorerChoice(bracket.getScorer(), playerId, bracket.getScorer(), false);
    }

    /**
     * Pichichi de una porra. En el cuadro de un torneo con grupos es el del cuadro, salvo que el administrador
     * le haya asignado un jugador y el nombre escrito siga siendo el mismo; en el resto de ligas, el elegido
     * aparte.
     *
     * @param row lo guardado aparte para esa porra; null si no hay nada
     */
    public static ScorerChoice of(Edition edition, Prediction prediction, ScorerPick row) {
        if (edition != null && edition.pichichiInBracket()) {
            ScorerChoice inBracket = of(prediction.getBracketData());
            boolean assigned = row != null && row.isResolvedByAdmin() && row.getPlayerName() != null
                    && sameWritten(row.getWrittenName(), inBracket.written());
            return assigned ? new ScorerChoice(inBracket.written(), row.getPlayerId(), row.getPlayerName(), true) : inBracket;
        }
        if (row == null) return written(null);
        return new ScorerChoice(row.getWrittenName(), row.getPlayerId(), row.getPlayerName(), row.isResolvedByAdmin());
    }

    /** Si dos nombres escritos son el mismo, sin contar espacios de más ni lo que pase de lo que se guarda. */
    private static boolean sameWritten(String stored, String current) {
        return stored != null && current != null && comparable(stored).equals(comparable(current));
    }

    private static String comparable(String written) {
        String text = written.replaceAll("\\p{Cntrl}", " ").replaceAll("\\s+", " ").trim();
        return text.length() <= 120 ? text : text.substring(0, 120);
    }

    public boolean isBlank() {
        return written == null || written.trim().isEmpty();
    }

    /** Se sabe a qué jugador se refiere, sin tener que emparejar el nombre. */
    public boolean hasPlayer() {
        return playerName != null && !playerName.isBlank();
    }
}
