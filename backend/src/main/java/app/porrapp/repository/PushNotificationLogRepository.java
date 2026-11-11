package app.porrapp.repository;

import app.porrapp.model.PushNotificationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Repository
public interface PushNotificationLogRepository extends JpaRepository<PushNotificationLog, Long> {

    List<PushNotificationLog> findTop3ByUserIdOrderBySentAtDescIdDesc(Long userId);

    List<PushNotificationLog> findByUserIdOrderBySentAtDesc(Long userId);

    boolean existsByUserIdAndTitleAndBodyAndUrlAndSentAtGreaterThanEqual(
            Long userId, String title, String body, String url, Instant sentAt);

    @Modifying
    @Transactional
    @Query("DELETE FROM PushNotificationLog l WHERE l.sentAt < :before")
    int deleteSentBefore(@Param("before") Instant before);
}
