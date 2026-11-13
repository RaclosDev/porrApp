package app.porrapp.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Resumen del panel de administración: cifras, altas por día, últimas cuentas y ligas. */
public record AdminOverviewDTO(
        Instant generatedAt,
        Totals totals,
        List<DayCount> signupsByDay,
        List<UserRow> recentUsers,
        List<LeagueRow> leagues) {

    public record Totals(
            long users,
            long newUsers24h,
            long newUsers7d,
            long newUsers30d,
            long active24h,
            long active7d,
            long leagues,
            long publicLeagues,
            long newLeagues7d,
            long memberships,
            Map<String, Long> leaguesByKind) {
    }

    /** Altas de un día (fecha de Madrid, {@code yyyy-MM-dd}). */
    public record DayCount(String day, long count) {
    }

    /** Una cuenta; {@code method} es google, apple o email. */
    public record UserRow(
            Long id,
            String name,
            String email,
            String method,
            Instant joinedAt,
            Instant lastActiveAt,
            long leagues) {
    }

    public record LeagueRow(
            Long id,
            String name,
            String kind,
            boolean isPublic,
            String owner,
            long members,
            Instant createdAt) {
    }
}
