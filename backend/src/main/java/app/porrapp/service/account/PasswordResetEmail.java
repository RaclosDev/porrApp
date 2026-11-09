package app.porrapp.service.account;

import app.porrapp.service.notification.EmailSender.Email;

import java.util.List;

/** Correo con el enlace para cambiar la contraseña ({@link AccountEmail}). */
final class PasswordResetEmail {

    static final String SUBJECT = "Cambia tu contraseña de PorrApp";

    private PasswordResetEmail() {
    }

    /**
     * @param participantName nombre público de la cuenta (se escapa)
     * @param link            enlace de un solo uso
     * @param baseUrl         dirección pública de la app, para el logo y el pie
     */
    static Email build(String to, String participantName, String link, String baseUrl) {
        return AccountEmail.build(to, new AccountEmail.Content(
                SUBJECT,
                "Pon una contraseña nueva. El enlace caduca en 30 minutos.",
                "Cambia tu contraseña",
                participantName,
                List.of("Pulsa el botón para poner una contraseña nueva en PorrApp."),
                null,
                "Cambiar mi contraseña",
                link,
                "Caduca en 30 minutos y solo sirve una vez. Si no lo has pedido tú, ignora este correo: "
                        + "tu contraseña no cambia.",
                true), baseUrl);
    }
}
