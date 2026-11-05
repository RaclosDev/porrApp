package com.porra.mundial.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Copia de los datos personales del usuario (derecho de acceso y portabilidad, arts. 15 y 20 RGPD).
 * Solo incluye datos propios: de otros miembros de sus ligas no se exporta nada.
 */
public record UserDataExport(
        LocalDateTime exportedAt,
        Profile profile,
        List<LeagueMembership> leagues,
        List<PredictionExport> predictions,
        List<PushDevice> pushDevices) {

    public record Profile(String email, String participantName, LocalDateTime registeredAt,
                          boolean hasAvatar, boolean matchRemindersEnabled, boolean memberJoinedAlertsEnabled) {
    }

    public record LeagueMembership(Long leagueId, String leagueName, String role, String paymentStatus,
                                   LocalDateTime joinedAt) {
    }

    public record PredictionExport(Long id, Long leagueId, String leagueName, String name, String paymentStatus,
                                   BigDecimal paymentAmount, Integer totalPoints, LocalDateTime createdAt,
                                   PredictionDataDTO bracket, List<MatchPick> matchPicks) {
    }

    public record MatchPick(Long matchId, Integer homeScore, Integer awayScore, String sign, Integer points,
                            LocalDateTime updatedAt) {
    }

    /** Del dispositivo solo se indica cuándo se activaron los avisos; las claves de cifrado no se exportan. */
    public record PushDevice(LocalDateTime subscribedAt) {
    }
}
