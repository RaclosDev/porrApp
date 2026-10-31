package com.porra.mundial.repository;

import com.porra.mundial.model.RefreshTokenFamily;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface RefreshTokenFamilyRepository extends JpaRepository<RefreshTokenFamily, Long> {

    /** SELECT ... FOR UPDATE: rotar, revocar y detectar reutilizaciones de una familia van en fila. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT f FROM RefreshTokenFamily f WHERE f.id = :id")
    Optional<RefreshTokenFamily> findByIdForUpdate(@Param("id") Long id);

    /** Borra las sesiones caducadas; sus tokens caen con ellas (ON DELETE CASCADE). */
    @Modifying
    @Query(value = "DELETE FROM refresh_token_families WHERE expires_at < :now", nativeQuery = true)
    int deleteExpired(@Param("now") Instant now);
}
