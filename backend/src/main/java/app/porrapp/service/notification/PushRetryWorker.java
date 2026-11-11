package app.porrapp.service.notification;

import app.porrapp.model.Membership;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PushDeliveryRetryRepository;
import app.porrapp.repository.PushNotificationLogRepository;
import app.porrapp.repository.PushSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class PushRetryWorker {
    private static final Pattern GROUP = Pattern.compile("[?&]group=(\\d+)(?:&|$)");
    private final PushDeliveryRetryRepository retries;
    private final PushSubscriptionRepository subscriptions;
    private final MembershipRepository memberships;
    private final PushNotificationLogRepository logs;
    private final PushNotificationLogService notificationLog;
    private final WebPushSender sender;
    private final ObjectMapper mapper;
    private final PlatformTransactionManager transactionManager;

    @Scheduled(initialDelay = 60_000, fixedDelay = 60_000)
    @SchedulerLock(name = "pushDeliveryRetries", lockAtMostFor = "PT10M")
    public void retryPending() {
        if (!sender.isEnabled()) return;
        Instant now = Instant.now();
        for (var pending : retries.findTop20ByNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(now)) {
            try {
                TransactionTemplate transaction = new TransactionTemplate(transactionManager);
                transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
                transaction.executeWithoutResult(status -> retry(pending.getId(), Instant.now()));
            } catch (RuntimeException error) {
                log.warn("Fallo al reintentar el aviso push {}: {}", pending.getId(), error.getClass().getSimpleName());
            }
        }
    }

    void retry(Long id, Instant now) {
        var pending = retries.findById(id).orElse(null);
        if (pending == null) return;
        var device = subscriptions.findById(pending.getSubscriptionId()).orElse(null);
        if (!pending.getExpiresAt().isAfter(now) || device == null
                || !device.getUser().getId().equals(pending.getUserId())) {
            retries.delete(pending);
            return;
        }
        PushMessage message = mapper.readValue(pending.getPayload(), PushMessage.class);
        if (!stillWants(device.getUser(), message)) {
            retries.delete(pending);
            return;
        }
        int ttl = (int) Duration.between(now, pending.getExpiresAt()).toSeconds();
        if (ttl < 1) {
            retries.delete(pending);
            return;
        }
        var result = sender.send(device.getEndpoint(), device.getP256dh(), device.getAuth(), pending.getPayload(), ttl);
        if (result == WebPushSender.Result.SENT) {
            if (!logs.existsByUserIdAndTitleAndBodyAndUrlAndSentAtGreaterThanEqual(
                    pending.getUserId(), message.title(), message.body(), message.url(), pending.getCreatedAt().minusSeconds(300))) {
                notificationLog.record(pending.getUserId(), message, now);
            }
            retries.delete(pending);
        } else if (result == WebPushSender.Result.GONE) {
            retries.delete(pending);
            subscriptions.deleteByEndpointAndUserId(device.getEndpoint(), pending.getUserId());
        } else {
            pending.setAttempts(pending.getAttempts() + 1);
            long delay = Math.min(1800, 60L << Math.min(pending.getAttempts(), 5));
            Instant next = now.plusSeconds(delay);
            pending.setNextAttemptAt(next.isBefore(pending.getExpiresAt()) ? next : pending.getExpiresAt());
            retries.save(pending);
        }
    }

    boolean stillWants(UserAccount user, PushMessage message) {
        String tag = message.tag() == null ? "" : message.tag();
        boolean enabled;
        if (tag.startsWith("member-joined-") || tag.startsWith("league-repeated-") || tag.startsWith("score-day-")) {
            enabled = user.isMemberJoinedAlertsEnabled();
        } else if (tag.startsWith("matchday-finished-") || tag.startsWith("gp-result-")) {
            enabled = user.isMatchdayFinishedAlertsEnabled();
        } else {
            enabled = user.isMatchRemindersEnabled();
        }
        if (!enabled) return false;
        var group = GROUP.matcher(message.url() == null ? "" : message.url());
        return !group.find() || memberships.existsById(
                new Membership.MembershipId(user.getId(), Long.parseLong(group.group(1))));
    }
}
