package com.porra.mundial.repository;

import com.porra.mundial.model.PasskeyChallenge;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface PasskeyChallengeRepository extends JpaRepository<PasskeyChallenge, String> {

    /** SELECT ... FOR UPDATE: dos respuestas al mismo reto van en fila y solo una lo encuentra. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM PasskeyChallenge c WHERE c.id = :id")
    Optional<PasskeyChallenge> findByIdForUpdate(@Param("id") String id);

    @Modifying
    @Query("DELETE FROM PasskeyChallenge c WHERE c.expiresAt < :now")
    int deleteExpired(@Param("now") Instant now);
}
