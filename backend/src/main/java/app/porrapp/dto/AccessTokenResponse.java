package app.porrapp.dto;

/** @param token access token nuevo (JWT de 15 minutos) */
public record AccessTokenResponse(String token) {
}
