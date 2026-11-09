package app.porrapp.dto;

/** Suscripción push de un dispositivo, tal como la devuelve {@code PushSubscription.toJSON()}. */
public record PushSubscriptionRequest(String endpoint, String p256dh, String auth) {
}
