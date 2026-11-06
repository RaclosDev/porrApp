package com.porra.mundial.repository;

import com.porra.mundial.model.Passkey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PasskeyRepository extends JpaRepository<Passkey, Long> {

    List<Passkey> findByUserIdOrderByCreatedAtAsc(Long userId);

    long countByUserId(Long userId);

    Optional<Passkey> findByCredentialId(byte[] credentialId);

    Optional<Passkey> findFirstByUserId(Long userId);

    Optional<Passkey> findFirstByUserHandle(byte[] userHandle);

    Optional<Passkey> findByIdAndUserId(Long id, Long userId);

    @Query("SELECT p.credentialId FROM Passkey p WHERE p.userId = :userId")
    List<byte[]> findCredentialIdsByUserId(@Param("userId") Long userId);
}
