package com.porra.mundial.service.notification;

/** Envío de correos transaccionales (por ahora, solo el de recuperar la contraseña). */
public interface EmailSender {

    /** Si hay proveedor configurado: sin él no se puede mandar nada. */
    boolean enabled();

    /**
     * Manda el correo sin esperar a la respuesta del proveedor: así responder a quien lo pide tarda
     * lo mismo exista o no la cuenta. Los fallos solo quedan en el log.
     */
    void send(Email email);

    /**
     * @param to      destinatario
     * @param subject asunto
     * @param text    cuerpo en texto plano
     * @param html    el mismo cuerpo en HTML
     */
    record Email(String to, String subject, String text, String html) {

        /** Que el contenido (con el enlace de un solo uso) no acabe en los logs. */
        @Override
        public String toString() {
            return "Email[subject=" + subject + "]";
        }
    }
}
