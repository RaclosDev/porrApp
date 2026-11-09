package app.porrapp.dto;

import app.porrapp.model.PredictionLockMode;
import app.porrapp.scoring.ScoringRuleSet;
import app.porrapp.service.league.LeagueSetup;
import app.porrapp.util.AppTime;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import tools.jackson.databind.JsonNode;

import java.time.LocalDateTime;

@Data
public class LeagueCreateDTO {

    /** Nombre visible del grupo. Ej: "Los Amigos del Barrio" */
    @NotBlank(message = "El nombre de la liga es obligatorio")
    private String name;

    /** ID de la competición (Mundial, Eurocopa) a la que está vinculado el grupo. */
    private Long competitionId;

    /** Nombre de una competición manual exclusiva de esta liga. */
    private String customCompetitionName;

    /** Deporte de la competición manual (FOOTBALL, BASKETBALL...). Sin indicarlo se juega con empate. */
    private String customSport;

    /** Formato o modalidad de la porra (FULL_BRACKET, KNOCKOUTS_ONLY, MATCH_DAY). */
    @NotBlank(message = "El formato de la porra es obligatorio")
    private String poolFormat;

    /** Indica si el grupo tendrá premio o clasificación específica para el Pichichi. */
    private Boolean pichichi = true;

    // Ajustes opcionales: sin ellos la liga se crea con los valores por defecto, como siempre.

    /** Normas de la liga (texto libre). */
    @Size(max = 8000, message = "Las reglas son demasiado largas")
    private String rules;

    /** Si la liga tiene cuota de inscripción. */
    private Boolean entryFee;

    /** Puntuación con los mismos campos que {@code PUT /api/groups/{id}/scoring}. */
    private JsonNode scoring;

    /** Cómo se cierran las predicciones, como en {@code PUT /api/groups/{id}/competition/lock}. */
    private PredictionLockMode lockMode;

    /** Margen en minutos antes del partido en los cierres que dependen de los partidos. */
    private Integer lockOffsetMinutes;

    /** Fecha de cierre en hora de Madrid, solo con {@code lockMode = FIXED_DATE}. */
    private LocalDateTime lockDate;

    /** Partidos que entran en una liga por jornadas, como en {@code PUT .../competition/match-selection}. */
    @jakarta.validation.Valid
    private MatchSelectionRequest matchSelection;

    /** Ajustes que acompañan a la creación. */
    public LeagueSetup toSetup() {
        return new LeagueSetup(rules, entryFee,
                scoring == null || scoring.isNull() ? null : ScoringRuleSet.fromRequest(scoring),
                lockMode, lockOffsetMinutes, AppTime.fromLocal(lockDate), matchSelection);
    }
}
