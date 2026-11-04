package com.porra.mundial.controller;

import com.porra.mundial.dto.PushConfigResponse;
import com.porra.mundial.dto.PushPreferencesRequest;
import com.porra.mundial.dto.PushSubscriptionRequest;
import com.porra.mundial.dto.StatusResponse;
import com.porra.mundial.service.PushSubscriptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

/** Avisos push del usuario autenticado: clave VAPID, dispositivos suscritos y preferencia. */
@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final PushSubscriptionService pushSubscriptionService;

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

    @PutMapping("/preferences")
    public StatusResponse preferences(@RequestBody PushPreferencesRequest request, Principal principal) {
        pushSubscriptionService.setRemindersEnabled(principal.getName(), request.remindersEnabled());
        return StatusResponse.success();
    }
}
