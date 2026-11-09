package app.porrapp.service.notification;

import app.porrapp.dto.PushNotificationResponse;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.PushNotificationLog;
import app.porrapp.repository.PushNotificationLogRepository;
import app.porrapp.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Historial de avisos push entregados, para que el usuario vea en la app los últimos que recibió.
 * Solo se guarda lo que ya se le mostró en el aviso y se borra pasados {@link #RETENTION}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PushNotificationLogService {

    static final Duration RETENTION = Duration.ofDays(30);
    private static final int MAX_TITLE = 255;
    private static final int MAX_BODY = 500;

    private final PushNotificationLogRepository logRepository;
    private final UserAccountRepository userAccountRepository;

    /** Anota un aviso entregado; un fallo al anotarlo no debe impedir el resto de envíos. */
    public void record(Long userId, PushMessage message, Instant sentAt) {
        try {
            logRepository.save(PushNotificationLog.builder()
                    .userId(userId)
                    .title(truncate(message.title(), MAX_TITLE))
                    .body(truncate(message.body(), MAX_BODY))
                    .url(message.url() == null ? null : truncate(message.url(), MAX_TITLE))
                    .sentAt(sentAt)
                    .build());
        } catch (RuntimeException e) {
            log.warn("No se pudo guardar el aviso enviado al usuario {}: {}", userId, e.getMessage());
        }
    }

    /** Los 3 últimos avisos del usuario, del más reciente al más antiguo. */
    @Transactional(readOnly = true)
    public List<PushNotificationResponse> recent(String email) {
        Long userId = userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado"))
                .getId();
        return logRepository.findTop3ByUserIdOrderBySentAtDescIdDesc(userId).stream()
                .map(l -> new PushNotificationResponse(l.getTitle(), l.getBody(), l.getUrl(), l.getSentAt()))
                .toList();
    }

    @Scheduled(cron = "0 30 4 * * *")
    @SchedulerLock(name = "pushNotificationLogCleanup", lockAtMostFor = "PT10M")
    public void deleteExpired() {
        int deleted = logRepository.deleteSentBefore(Instant.now().minus(RETENTION));
        if (deleted > 0) log.info("Borrados {} avisos push antiguos", deleted);
    }

    private static String truncate(String value, int max) {
        String text = value == null ? "" : value;
        return text.length() <= max ? text : text.substring(0, max - 1) + "…";
    }
}
