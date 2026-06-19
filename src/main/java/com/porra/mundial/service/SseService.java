package com.porra.mundial.service;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
@Slf4j
public class SseService {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter createEmitter() {
        // 1 hora de timeout
        SseEmitter emitter = new SseEmitter(3600000L);
        this.emitters.add(emitter);

        emitter.onCompletion(() -> this.emitters.remove(emitter));
        emitter.onTimeout(() -> {
            emitter.complete();
            this.emitters.remove(emitter);
        });
        emitter.onError((e) -> {
            emitter.completeWithError(e);
            this.emitters.remove(emitter);
        });

        // Enviar un mensaje de conexión inicial
        try {
            emitter.send(SseEmitter.event().name("CONNECT").data("Conectado al servidor de actualizaciones"));
        } catch (IOException e) {
            emitter.completeWithError(e);
            this.emitters.remove(emitter);
        }

        return emitter;
    }

    public void broadcast(String eventType, Object data) {
        List<SseEmitter> deadEmitters = new java.util.ArrayList<>();
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name(eventType)
                        .data(data));
            } catch (Exception e) {
                log.info("Limpiando túnel zombi (un usuario cerró la pestaña)");
                deadEmitters.add(emitter);
            }
        }
        emitters.removeAll(deadEmitters);
    }
    
    public void broadcastUpdate(String eventType) {
        broadcast(eventType, "{\"updated\": true}");
    }
}
