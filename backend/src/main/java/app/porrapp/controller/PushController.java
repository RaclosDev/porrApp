package app.porrapp.controller;

import app.porrapp.dto.PushConfigResponse;
import app.porrapp.dto.PushNotificationResponse;
import app.porrapp.dto.PushPreferencesRequest;
import app.porrapp.dto.PushSubscriptionRequest;
import app.porrapp.dto.StatusResponse;
import app.porrapp.service.notification.PushNotificationLogService;
import app.porrapp.service.notification.PushSubscriptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/** Avisos push del usuario autenticado: clave VAPID, dispositivos suscritos, preferencias y últimos avisos. */
@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final PushSubscriptionService pushSubscriptionService;
    private final PushNotificationLogService notificationLogService;

    @GetMapping("/config")
    public PushConfigResponse config(Principal principal) {
        return pushSubscriptionService.config(principal.getName());
    }

    @PostMapping("/subscriptions")
    public StatusResponse subscribe(@RequestBody PushSubscriptionRequest request, Principal principal) {
        pushSubscriptionService.subscribe(principal.getName(), request);
        return StatusResponse.success();
    }

    @DeleteMapping("/subscriptions")
    public StatusResponse unsubscribe(@RequestBody PushSubscriptionRequest request, Principal principal) {
        pushSubscriptionService.unsubscribe(principal.getName(), request.endpoint());
        return StatusResponse.success();
    }

    /** Los 3 últimos avisos que han llegado al usuario, del más reciente al más antiguo. */
    @GetMapping("/recent")
    public List<PushNotificationResponse> recent(Principal principal) {
        return notificationLogService.recent(principal.getName());
    }

    @PutMapping("/preferences")
    public StatusResponse preferences(@RequestBody PushPreferencesRequest request, Principal principal) {
        pushSubscriptionService.setPreferences(principal.getName(), request.remindersEnabled(),
                request.memberJoinedEnabled(), request.matchdayFinishedEnabled());
        return StatusResponse.success();
    }
}
