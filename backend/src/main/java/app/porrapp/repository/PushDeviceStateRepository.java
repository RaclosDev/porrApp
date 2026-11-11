package app.porrapp.repository;

import app.porrapp.model.PushDeviceState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import java.time.Instant;
import java.util.UUID;

public interface PushDeviceStateRepository extends JpaRepository<PushDeviceState, Long> {
    @Modifying
    @Query(value = """
            INSERT INTO push_device_states (user_id, device_id, permission, install_required, observed_at, last_prompt_at)
            VALUES (:userId, :deviceId, :permission, :installRequired, :now,
                CASE WHEN :promptShown THEN CAST(:now AS timestamptz) ELSE NULL END)
            ON CONFLICT (user_id, device_id) DO UPDATE SET permission = EXCLUDED.permission,
                install_required = EXCLUDED.install_required, observed_at = EXCLUDED.observed_at,
                last_prompt_at = COALESCE(EXCLUDED.last_prompt_at, push_device_states.last_prompt_at)
            """, nativeQuery = true)
    void observe(Long userId, UUID deviceId, String permission, boolean installRequired, boolean promptShown, Instant now);
}
