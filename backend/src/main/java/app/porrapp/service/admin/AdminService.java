package app.porrapp.service.admin;

import app.porrapp.dto.AdminOverviewDTO;
import app.porrapp.dto.AdminOverviewDTO.DayCount;
import app.porrapp.dto.AdminOverviewDTO.LeagueRow;
import app.porrapp.dto.AdminOverviewDTO.Totals;
import app.porrapp.dto.AdminOverviewDTO.UserRow;
import app.porrapp.model.League;
import app.porrapp.model.UserAccount;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Cifras y listados de solo lectura para el panel de administración. */
@Service
public class AdminService {

    private static final ZoneId MADRID = ZoneId.of("Europe/Madrid");
    private static final int RECENT_USERS = 100;
    private static final int LEAGUES = 200;
    private static final int DAYS = 30;

    private final EntityManager em;

    public AdminService(EntityManager em) {
        this.em = em;
    }

    @Transactional(readOnly = true)
    public AdminOverviewDTO overview() {
        Instant now = Instant.now();
        return new AdminOverviewDTO(now, totals(now), signupsByDay(now), recentUsers(), leagues());
    }

    private Totals totals(Instant now) {
        Instant d1 = now.minus(Duration.ofDays(1));
        Instant d7 = now.minus(Duration.ofDays(7));
        Instant d30 = now.minus(Duration.ofDays(30));
        Map<String, Long> byKind = new TreeMap<>();
        for (Object[] row : em.createQuery("select l.kind, count(l) from League l group by l.kind", Object[].class)
                .getResultList()) {
            byKind.put((String) row[0], (Long) row[1]);
        }
        return new Totals(
                countUsers("1=1", null),
                countUsers("u.linkedAt >= :since", d1),
                countUsers("u.linkedAt >= :since", d7),
                countUsers("u.linkedAt >= :since", d30),
                countUsers("u.lastActiveAt >= :since", d1),
                countUsers("u.lastActiveAt >= :since", d7),
                count("select count(l) from League l"),
                count("select count(l) from League l where l.publicLeague = true"),
                em.createQuery("select count(l) from League l where l.createdAt >= :since", Long.class)
                        .setParameter("since", d7).getSingleResult(),
                count("select count(m) from Membership m"),
                byKind);
    }

    private long countUsers(String condition, Instant since) {
        var query = em.createQuery("select count(u) from UserAccount u where u.googleEmail <> :system and "
                + condition, Long.class).setParameter("system", UserAccount.SYSTEM_ADMIN_EMAIL);
        if (since != null) {
            query.setParameter("since", since);
        }
        return query.getSingleResult();
    }

    private long count(String jpql) {
        return em.createQuery(jpql, Long.class).getSingleResult();
    }

    private List<DayCount> signupsByDay(Instant now) {
        LocalDate today = now.atZone(MADRID).toLocalDate();
        LocalDate first = today.minusDays(DAYS - 1L);
        Map<LocalDate, Long> perDay = new TreeMap<>();
        for (int i = 0; i < DAYS; i++) {
            perDay.put(first.plusDays(i), 0L);
        }
        List<Instant> joined = em.createQuery(
                        "select u.linkedAt from UserAccount u where u.googleEmail <> :system and u.linkedAt >= :since",
                        Instant.class)
                .setParameter("system", UserAccount.SYSTEM_ADMIN_EMAIL)
                .setParameter("since", first.atStartOfDay(MADRID).toInstant())
                .getResultList();
        for (Instant at : joined) {
            perDay.merge(at.atZone(MADRID).toLocalDate(), 1L, Long::sum);
        }
        List<DayCount> result = new ArrayList<>();
        perDay.forEach((day, n) -> result.add(new DayCount(day.toString(), n)));
        return result;
    }

    private List<UserRow> recentUsers() {
        List<UserAccount> users = em.createQuery(
                        "select u from UserAccount u where u.googleEmail <> :system order by u.linkedAt desc, u.id desc",
                        UserAccount.class)
                .setParameter("system", UserAccount.SYSTEM_ADMIN_EMAIL)
                .setMaxResults(RECENT_USERS)
                .getResultList();
        Map<Long, Long> leagueCounts = users.isEmpty() ? Map.of() : counts(
                "select m.user.id, count(m) from Membership m where m.user.id in :ids group by m.user.id",
                users.stream().map(UserAccount::getId).toList());
        return users.stream()
                .map(u -> new UserRow(u.getId(), u.getParticipantName(), u.getGoogleEmail(), method(u),
                        u.getLinkedAt(), u.getLastActiveAt(), leagueCounts.getOrDefault(u.getId(), 0L)))
                .toList();
    }

    private List<LeagueRow> leagues() {
        List<League> leagues = em.createQuery(
                        "select l from League l left join fetch l.adminUser order by l.createdAt desc, l.id desc",
                        League.class)
                .setMaxResults(LEAGUES)
                .getResultList();
        Map<Long, Long> members = leagues.isEmpty() ? Map.of() : counts(
                "select m.league.id, count(m) from Membership m where m.league.id in :ids group by m.league.id",
                leagues.stream().map(League::getId).toList());
        return leagues.stream()
                .map(l -> new LeagueRow(l.getId(), l.getName(), l.getKind(), l.isPublicLeague(),
                        l.getAdminUser() != null ? l.getAdminUser().getParticipantName() : null,
                        members.getOrDefault(l.getId(), 0L), l.getCreatedAt()))
                .toList();
    }

    private Map<Long, Long> counts(String jpql, List<Long> ids) {
        Map<Long, Long> result = new HashMap<>();
        for (Object[] row : em.createQuery(jpql, Object[].class).setParameter("ids", ids).getResultList()) {
            result.put((Long) row[0], (Long) row[1]);
        }
        return result;
    }

    private static String method(UserAccount user) {
        if (user.getGoogleSub() != null) {
            return "google";
        }
        return user.getAppleSub() != null ? "apple" : "email";
    }
}
