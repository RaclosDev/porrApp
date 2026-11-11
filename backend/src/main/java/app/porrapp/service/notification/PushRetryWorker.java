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
        Instant now = Instant.now();
        new TransactionTemplate(transactionManager).executeWithoutResult(
                status -> retries.deleteExpiredBefore(now.minusSeconds(7 * 86400)));
        if (!sender.isEnabled()) return;
        for (var pending : retries.findTop20ByFinishedAtIsNullAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(now)) {
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
        if (pending == null || pending.getReceivedAt() != null || pending.getFinishedAt() != null) return;
        var device = subscriptions.findById(pending.getSubscriptionId()).orElse(null);
        if (!pending.getExpiresAt().isAfter(now) || device == null
                || !device.getUser().getId().equals(pending.getUserId())) {
            finish(pending, now);
            return;
        }
        PushMessage message = mapper.readValue(pending.getPayload(), PushMessage.class);
        if (!stillWants(device.getUser(), message)) {
            finish(pending, now);
            return;
        }
        int ttl = (int) Duration.between(now, pending.getExpiresAt()).toSeconds();
        boolean tracked = pending.getReceiptToken() != null;
        if (ttl < 1 || (tracked && pending.getAttempts() >= PushRetryQueue.MAX_TRACKED_ATTEMPTS)) {
            finish(pending, now);
            return;
        }
        var result = sender.send(device.getEndpoint(), device.getP256dh(), device.getAuth(), PushRetryQueue.wirePayload(pending), ttl);
        pending.setAttempts(pending.getAttempts() + 1);
        if (result == WebPushSender.Result.SENT) {
            if (!"push-test".equals(message.tag()) && !logs.existsByUserIdAndTitleAndBodyAndUrlAndSentAtGreaterThanEqual(
                    pending.getUserId(), message.title(), message.body(), message.url(), pending.getCreatedAt().minusSeconds(300))) {
                notificationLog.record(pending.getUserId(), message, now);
            }
            if (tracked) {
                PushRetryQueue.accepted(pending, now);
                schedule(pending, now);
            } else {
                retries.delete(pending);
            }
        } else if (result == WebPushSender.Result.GONE) {
            retries.delete(pending);
            subscriptions.deleteByEndpointAndUserId(device.getEndpoint(), pending.getUserId());
        } else {
            schedule(pending, now);
        }
    }

    private void finish(app.porrapp.model.PushDeliveryRetry pending, Instant now) {
        if (pending.getReceiptToken() == null) retries.delete(pending);
        else {
            pending.setFinishedAt(now);
            retries.save(pending);
        }
    }

    private void schedule(app.porrapp.model.PushDeliveryRetry pending, Instant now) {
        if (pending.getReceiptToken() != null && pending.getAttempts() >= PushRetryQueue.MAX_TRACKED_ATTEMPTS) {
            pending.setFinishedAt(now);
        }
        long delay = Math.min(1800, 60L << Math.min(pending.getAttempts(), 5));
        Instant next = now.plusSeconds(delay);
        pending.setNextAttemptAt(next.isBefore(pending.getExpiresAt()) ? next : pending.getExpiresAt());
        retries.save(pending);
    }

    boolean stillWants(UserAccount user, PushMessage message) {
        String tag = message.tag() == null ? "" : message.tag();
        if (tag.equals("push-test")) return true;
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
