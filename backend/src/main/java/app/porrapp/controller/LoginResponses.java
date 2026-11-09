package app.porrapp.controller;

import app.porrapp.dto.LoginResponse;
import app.porrapp.model.UserAccount;
import app.porrapp.service.account.SessionService.SessionTokens;

/** Cuerpo de respuesta de un inicio de sesión, sea con Google o con una llave de acceso. */
final class LoginResponses {

    private LoginResponses() {
    }

    static LoginResponse of(SessionTokens session) {
        UserAccount user = session.user();
        return new LoginResponse(
                session.accessToken(),
                user.getId(),
                user.getParticipantName(),
                "login_success",
                user.getLastSelectedGroupId() != null ? user.getLastSelectedGroupId() : -1L,
                user.getAvatarUrl() != null ? user.getAvatarUrl() : "");
    }
}
