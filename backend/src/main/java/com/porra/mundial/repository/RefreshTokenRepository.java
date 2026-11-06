package com.porra.mundial.repository;

import com.porra.mundial.model.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    /** Solo el id de la familia, sin cargar el token: su estado se lee después de bloquear la familia. */
    @Query("SELECT t.familyId FROM RefreshToken t WHERE t.tokenHash = :hash")
    Optional<Long> findFamilyIdByTokenHash(@Param("hash") String tokenHash);

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /** Olvida los tokens rotados hace tiempo de las sesiones que siguen vivas. */
    @Modifying
    @Query(value = "DELETE FROM refresh_tokens WHERE rotated_at < :cutoff", nativeQuery = true)
    int deleteRotatedBefore(@Param("cutoff") Instant cutoff);
}
