package app.porrapp.repository;

import app.porrapp.model.PasswordResetToken;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    /** SELECT ... FOR UPDATE: dos usos a la vez del mismo enlace van en fila y solo uno lo encuentra. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM PasswordResetToken t WHERE t.tokenHash = :hash")
    Optional<PasswordResetToken> findByTokenHashForUpdate(@Param("hash") String tokenHash);

    /** Si la cuenta ha pedido un enlace hace poco (para no mandar un correo tras otro). */
    boolean existsByUserIdAndCreatedAtAfter(Long userId, Instant since);

    @Modifying
    @Query("DELETE FROM PasswordResetToken t WHERE t.userId = :userId")
    int deleteByUserId(@Param("userId") Long userId);

    @Modifying
    @Query("DELETE FROM PasswordResetToken t WHERE t.expiresAt < :now")
    int deleteExpired(@Param("now") Instant now);
}
