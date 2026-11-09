package app.porrapp.repository;

import app.porrapp.model.SessionHandoff;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface SessionHandoffRepository extends JpaRepository<SessionHandoff, Long> {

    /** SELECT ... FOR UPDATE: dos canjes a la vez del mismo código van en fila y solo uno lo encuentra. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT h FROM SessionHandoff h WHERE h.codeHash = :hash")
    Optional<SessionHandoff> findByCodeHashForUpdate(@Param("hash") String codeHash);

    @Modifying
    @Query("DELETE FROM SessionHandoff h WHERE h.userId = :userId")
    int deleteByUserId(@Param("userId") Long userId);

    @Modifying
    @Query("DELETE FROM SessionHandoff h WHERE h.expiresAt < :now")
    int deleteExpired(@Param("now") Instant now);
}
