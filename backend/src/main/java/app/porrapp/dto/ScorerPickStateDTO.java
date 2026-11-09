package app.porrapp.dto;

import java.time.Instant;

/**
 * Pichichi de una liga para quien la consulta.
 *
 * @param enabled    la liga juega el pichichi
 * @param inBracket  se elige al rellenar el cuadro, no aparte
 * @param locked     ya no se puede elegir ni cambiar
 * @param lockAt     cuándo se cierra; null si aún no se sabe
 * @param mine       el de quien consulta; null si no ha elegido
 * @param canResolve quien consulta es el administrador y puede asignar ahora los dudosos
 */
public record ScorerPickStateDTO(
        boolean enabled,
        boolean inBracket,
        boolean locked,
        Instant lockAt,
        ScorerPickDTO mine,
        boolean canResolve) {

    public static ScorerPickStateDTO disabled() {
        return new ScorerPickStateDTO(false, false, false, null, null, false);
    }
}
