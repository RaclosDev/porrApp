package com.porra.mundial.repository;

import com.porra.mundial.model.PendingRegistration;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface PendingRegistrationRepository extends JpaRepository<PendingRegistration, Long> {

    /** SELECT ... FOR UPDATE: dos intentos a la vez con el mismo email van en fila. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM PendingRegistration p WHERE p.email = :email")
    Optional<PendingRegistration> findByEmailForUpdate(@Param("email") String email);

    @Modifying
    @Query("DELETE FROM PendingRegistration p WHERE p.email = :email")
    int deleteByEmail(@Param("email") String email);

    @Modifying
    @Query("DELETE FROM PendingRegistration p WHERE p.expiresAt < :now")
    int deleteExpired(@Param("now") Instant now);
}
