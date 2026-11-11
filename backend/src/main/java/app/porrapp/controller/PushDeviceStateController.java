package app.porrapp.controller;

import app.porrapp.dto.PushDeviceStateRequest;
import app.porrapp.service.notification.PushDeviceStateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;

@RestController
@RequiredArgsConstructor
public class PushDeviceStateController {
    private final PushDeviceStateService states;

    @PostMapping("/api/push/device-state")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void observe(@Valid @RequestBody PushDeviceStateRequest request, Principal principal) {
        states.observe(principal.getName(), request);
    }
}
