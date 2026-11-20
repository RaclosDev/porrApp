package app.porrapp.dto;

/**
 * Resultado de un aviso del administrador. {@code sent}: aceptados por el servicio push;
 * {@code retrying}: no aceptados a la primera, se reintentan solos; {@code failed}: no se entregarán
 * (suscripción caducada, que se borra, o rechazo sin reintento).
 */
public record AdminAnnouncementResult(int leagues, int members, int devices, int sent, int retrying, int failed) {
}
