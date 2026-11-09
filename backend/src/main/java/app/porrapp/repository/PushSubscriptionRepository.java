package app.porrapp.repository;

import app.porrapp.model.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    Optional<PushSubscription> findByEndpoint(String endpoint);

    List<PushSubscription> findByUserIdOrderByCreatedAtAsc(Long userId);

    @Query("SELECT s FROM PushSubscription s WHERE s.user.id IN :userIds")
    List<PushSubscription> findByUserIdIn(@Param("userIds") Collection<Long> userIds);

    @Modifying
    @Transactional
    @Query("DELETE FROM PushSubscription s WHERE s.endpoint = :endpoint AND s.user.id = :userId")
    int deleteByEndpointAndUserId(@Param("endpoint") String endpoint, @Param("userId") Long userId);

    @Modifying
    @Transactional
    @Query("DELETE FROM PushSubscription s WHERE s.endpoint = :endpoint")
    int deleteByEndpoint(@Param("endpoint") String endpoint);
}
