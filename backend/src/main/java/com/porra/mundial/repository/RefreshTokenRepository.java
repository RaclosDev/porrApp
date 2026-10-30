package com.porra.mundial.repository;

import com.porra.mundial.model.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    /** Solo el id de la familia, sin cargar el token: su estado se lee después de bloquear la familia. */
    @Query("SELECT t.familyId FROM RefreshToken t WHERE t.tokenHash = :hash")
    Optional<Long> findFamilyIdByTokenHash(@Param("hash") String tokenHash);

    Optional<RefreshToken> findByTokenHash(String tokenHash);
}
