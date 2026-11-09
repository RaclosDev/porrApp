package app.porrapp.dto;

import app.porrapp.model.Fight;
import app.porrapp.model.Match;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Objects;

/** Datos de pelea de un partido de la UFC: velada, bloque de la cartelera y cómo acabó. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FightInfoDTO {
    private String eventId;
    private String eventName;
    /** MAIN (estelar), PRELIMS o EARLY_PRELIMS. */
    private String segment;
    /** Orden en la cartelera: 1 es la pelea estelar. */
    private Integer order;
    private String weightClass;
    /** Título en juego («UFC Heavyweight Title»); null si no hay título. */
    private String title;
    private Integer scheduledRounds;
    private String homeRecord;
    private String awayRecord;
    /** KO_TKO, SUBMISSION, DECISION, DRAW, NO_CONTEST, DISQUALIFICATION u OTHER; null si no ha acabado. */
    private String resultMethod;
    private String resultDetail;
    private Integer resultRound;
    private String resultClock;
    /** Tarjetas de los jueces de una decisión («30-27 | 29-28 | 30-27»). */
    private String judgesScores;
    /** "1" si ganó la esquina roja, "2" la azul; null sin ganador. */
    private String winner;

    public static FightInfoDTO of(Fight fight, Match match) {
        if (fight == null) return null;
        String winner = null;
        if (match.getWinnerTeam() != null && match.getWinnerTeam().getId() != null) {
            Long id = match.getWinnerTeam().getId();
            if (match.getHomeTeam() != null && Objects.equals(id, match.getHomeTeam().getId())) winner = "1";
            else if (match.getAwayTeam() != null && Objects.equals(id, match.getAwayTeam().getId())) winner = "2";
        }
        return FightInfoDTO.builder()
                .eventId(fight.getEventExternalId())
                .eventName(match.getRound())
                .segment(fight.getCardSegment())
                .order(fight.getBoutOrder())
                .weightClass(fight.getWeightClass())
                .title(fight.getTitle())
                .scheduledRounds(fight.getScheduledRounds())
                .homeRecord(fight.getHomeRecord())
                .awayRecord(fight.getAwayRecord())
                .resultMethod(fight.getResultMethod() != null ? fight.getResultMethod().name() : null)
                .resultDetail(fight.getResultDetail())
                .resultRound(fight.getResultRound())
                .resultClock(fight.getResultClock())
                .judgesScores(fight.getJudgesScores())
                .winner(winner)
                .build();
    }
}
