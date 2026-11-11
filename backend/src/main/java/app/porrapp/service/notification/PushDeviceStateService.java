package app.porrapp.service.notification;

import app.porrapp.dto.PushDeviceStateRequest;
import app.porrapp.exception.BusinessException;
import app.porrapp.repository.PushDeviceStateRepository;
import app.porrapp.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class PushDeviceStateService {
    private final PushDeviceStateRepository states;
    private final UserAccountRepository users;

    @Transactional
    public void observe(String email, PushDeviceStateRequest request) {
        var user = users.findByGoogleEmail(email)
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado"));
        states.observe(user.getId(), request.deviceId(), request.permission(), request.installRequired(),
                request.promptShown(), Instant.now());
    }
}
