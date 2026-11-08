package com.porra.mundial.service.account;

import com.porra.mundial.model.UserAccount;
import com.porra.mundial.service.notification.EmailSender.Email;

import java.util.List;

/** Correos del registro con contraseña y avisos de la cuenta ({@link AccountEmail}). */
final class AccountNoticeEmails {

    private AccountNoticeEmails() {
    }

    /** Código de 6 dígitos para terminar de crear la cuenta. */
    static Email registrationCode(String to, String code, long minutes, String baseUrl) {
        return AccountEmail.build(to, new AccountEmail.Content(
                // El código no va en el asunto: el asunto acaba en los logs si el envío falla.
                "Tu código para crear la cuenta en PorrApp",
                "Tu código es " + code + ". Escríbelo en PorrApp para terminar de crear tu cuenta.",
                "Tu código para crear la cuenta",
                null,
                List.of("Escribe este código en PorrApp para terminar de crear tu cuenta:"),
                code,
                "Abrir PorrApp",
                baseUrl,
                "Caduca en " + minutes + " minutos. Si no has sido tú, ignora este correo: no se crea ninguna cuenta.",
                false), baseUrl);
    }

    /**
     * Alguien ha intentado crear una cuenta con un email que ya tiene una. Se avisa por correo en vez
     * de decirlo en pantalla, para no revelar qué emails están registrados.
     *
     * @param provider «Google» o «Apple» si la cuenta entra con ellos; {@code null} si tiene contraseña
     */
    static Email alreadyRegistered(String to, String participantName, String provider, String baseUrl) {
        String how = provider != null
                ? "Tu cuenta entra con " + provider + ": pulsa «Continuar con " + provider + "» en la pantalla de acceso."
                : "Entra con tu email y tu contraseña. Si no la recuerdas, pulsa «¿Has olvidado la contraseña?».";
        return AccountEmail.build(to, new AccountEmail.Content(
                "Ya tienes cuenta en PorrApp",
                "No hace falta crear otra: entra con la que ya tienes.",
                "Ya tienes cuenta",
                participantName,
                List.of("Alguien, seguramente tú, ha intentado crear una cuenta de PorrApp con este email, pero ya tienes una.",
                        how),
                null,
                "Ir a PorrApp",
                baseUrl,
                "Si no has sido tú, ignora este correo: tu cuenta no ha cambiado.",
                false), baseUrl);
    }

    /** Han pedido cambiar la contraseña de una cuenta que entra con Google o Apple. */
    static Email signsInWithProvider(String to, String participantName, String provider, String baseUrl) {
        return AccountEmail.build(to, new AccountEmail.Content(
                "Tu cuenta de PorrApp entra con " + provider,
                "Tu cuenta no tiene contraseña: entra con " + provider + ".",
                "Tu cuenta entra con " + provider,
                participantName,
                List.of("Has pedido cambiar la contraseña, pero tu cuenta de PorrApp no tiene: entra con " + provider + ".",
                        "Pulsa «Continuar con " + provider + "» en la pantalla de acceso."),
                null,
                "Ir a PorrApp",
                baseUrl,
                "Si no lo has pedido tú, ignora este correo: tu cuenta no ha cambiado.",
                false), baseUrl);
    }

    /** «Google» o «Apple» según con qué entra la cuenta (Google si tiene los dos). */
    static String provider(UserAccount user) {
        return user.getGoogleSub() == null && user.getAppleSub() != null ? "Apple" : "Google";
    }
}
