package app.porrapp.dto;

import java.time.Instant;

/** Un aviso push ya enviado al usuario, para el centro de avisos. */
public record PushNotificationResponse(String title, String body, String url, Instant sentAt) {
}
