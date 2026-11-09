package app.porrapp.service.notification;

import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.Map;

/** Contenido de un aviso push: título, texto, ruta de la app al pulsarlo y etiqueta para agruparlo. */
public record PushMessage(String title, String body, String url, String tag) {

    /** JSON que recibe el service worker (public/sw-push.js). */
    public String toJson(ObjectMapper objectMapper) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("title", title);
        message.put("body", body);
        message.put("url", url);
        message.put("tag", tag);
        return objectMapper.writeValueAsString(message);
    }
}
