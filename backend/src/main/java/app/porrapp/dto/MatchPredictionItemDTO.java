package app.porrapp.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class MatchPredictionItemDTO {

    @NotNull(message = "El ID del partido es obligatorio")
    private Long matchId;

    @Min(value = 0, message = "Los goles no pueden ser negativos")
    @Max(value = 99, message = "Los goles no pueden pasar de 99")
    private Integer homeScore;

    @Min(value = 0, message = "Los goles no pueden ser negativos")
    @Max(value = 99, message = "Los goles no pueden pasar de 99")
    private Integer awayScore;

    private String sign; // "1", "X", "2"

    /** Pelea de la UFC: método (KO_TKO, SUBMISSION o DECISION), opcional. */
    private String method;

    /** Pelea de la UFC: asalto, solo con KO_TKO o SUBMISSION. */
    @Min(value = 1, message = "El asalto va del 1 al 5")
    @Max(value = 5, message = "El asalto va del 1 al 5")
    private Integer round;
}
