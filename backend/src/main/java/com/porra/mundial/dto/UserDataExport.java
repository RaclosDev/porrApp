package com.porra.mundial.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Copia de los datos personales del usuario (derecho de acceso y portabilidad, arts. 15 y 20 RGPD).
 * Solo incluye datos propios: de otros miembros de sus ligas no se exporta nada.
 */
public record UserDataExport(
        Instant exportedAt,
        Profile profile,
        List<LeagueMembership> leagues,
        List<PredictionExport> predictions,
        List<PushDevice> pushDevices,
        List<SentNotification> pushNotifications,
        List<PasskeyExport> passkeys) {

    /** De cada llave de acceso, su nombre y fechas; la clave pública no es un dato personal útil. */
    public record PasskeyExport(String name, Instant createdAt, Instant lastUsedAt) {
    }

    public record Profile(String email, String participantName, Instant registeredAt,
                          java.time.Instant lastActiveAt, boolean hasAvatar, boolean matchRemindersEnabled, boolean memberJoinedAlertsEnabled) {
    }

    public record LeagueMembership(Long leagueId, String leagueName, String role, String paymentStatus,
                                   Instant joinedAt) {
    }

    public record PredictionExport(Long id, Long leagueId, String leagueName, String name, String paymentStatus,
                                   BigDecimal paymentAmount, Integer totalPoints, Instant createdAt,
                                   PredictionDataDTO bracket, List<MatchPick> matchPicks) {
    }

    public record MatchPick(Long matchId, Integer homeScore, Integer awayScore, String sign, Integer points,
                            Instant updatedAt) {
    }

    /** Del dispositivo solo se indica cuándo se activaron los avisos; las claves de cifrado no se exportan. */
    public record PushDevice(Instant subscribedAt) {
    }

    /** Avisos push recibidos en los últimos 30 días. */
    public record SentNotification(String title, String body, Instant sentAt) {
    }
}
