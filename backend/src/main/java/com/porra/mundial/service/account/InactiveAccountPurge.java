package com.porra.mundial.service.account;

import com.porra.mundial.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;

/**
 * Plazo de conservación: cada noche borra las cuentas que llevan {@link #INACTIVITY_MONTHS} meses
 * sin iniciar ni refrescar sesión, con todos sus datos, como si las borrara su titular.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InactiveAccountPurge {

    public static final int INACTIVITY_MONTHS = 24;

    private final UserAccountRepository userAccountRepository;
    private final AccountDeletionService accountDeletionService;
    private Clock clock = Clock.systemUTC();

    void setClock(Clock clock) {
        this.clock = clock;
    }

    @Scheduled(cron = "0 45 4 * * *")
    @SchedulerLock(name = "inactiveAccountPurge", lockAtMostFor = "PT30M", lockAtLeastFor = "PT5M")
    public void purgeInactiveAccounts() {
        Instant cutoff = ZonedDateTime.now(clock).withZoneSameInstant(ZoneOffset.UTC).minusMonths(INACTIVITY_MONTHS).toInstant();
        List<Long> inactive = userAccountRepository.findIdsInactiveSince(cutoff);
        int deleted = 0;
        for (Long userId : inactive) {
            try {
                accountDeletionService.deleteInactiveAccount(userId);
                deleted++;
            } catch (RuntimeException e) {
                log.warn("No se pudo borrar la cuenta inactiva {}: {}", userId, e.getMessage());
            }
        }
        if (deleted > 0) {
            log.info("Borradas {} cuentas inactivas desde hace {} meses.", deleted, INACTIVITY_MONTHS);
        }
    }
}
