package com.porra.mundial.service.account;

import com.porra.mundial.service.notification.EmailSender.Email;

/**
 * Correo con el enlace para cambiar la contraseña, con la imagen de PorrApp: papel crema, tinta
 * oscura y el logo. HTML de tablas y estilos en línea, que es lo único que respetan todos los
 * clientes de correo; siempre va también en texto plano.
 */
final class PasswordResetEmail {

    static final String SUBJECT = "Cambia tu contraseña de PorrApp";

    private static final String PAPER = "#f3ecdc";
    private static final String CARD = "#fffdf7";
    private static final String INK = "#111827";
    private static final String MUTED = "#4b5563";

    private PasswordResetEmail() {
    }

    /**
     * @param participantName nombre público de la cuenta (se escapa)
     * @param link            enlace de un solo uso
     * @param baseUrl         dirección pública de la app, para el logo y el pie
     */
    static Email build(String to, String participantName, String link, String baseUrl) {
        return new Email(to, SUBJECT, text(participantName, link), html(participantName, link, baseUrl));
    }

    private static String text(String name, String link) {
        return """
                Hola, %s:

                Para poner una contraseña nueva en PorrApp, abre este enlace:
                %s

                Caduca en 30 minutos y solo sirve una vez. Si no lo has pedido tú, ignora este correo:
                tu contraseña no cambia.

                PorrApp
                """.formatted(name, link);
    }

    private static String html(String rawName, String link, String baseUrl) {
        String name = escape(rawName);
        String host = baseUrl.replaceFirst("^https?://", "");
        return """
                <!DOCTYPE html>
                <html lang="es">
                <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <meta name="color-scheme" content="light">
                <meta name="supported-color-schemes" content="light">
                <title>%1$s</title>
                </head>
                <body style="margin:0;padding:0;background:%2$s;">
                <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Pon una contraseña nueva. El enlace caduca en 30 minutos.</div>
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="background:%2$s;">
                  <tr>
                    <td align="center" style="padding:32px 16px;">
                      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
                        <tr>
                          <td align="center" style="padding-bottom:20px;">
                            <img src="%3$s/icon-paper-192.png" width="72" height="72" alt="PorrApp" style="display:block;border:0;border-radius:16px;">
                          </td>
                        </tr>
                        <tr>
                          <td style="background:%4$s;border:2px solid %5$s;border-radius:6px;padding:32px 28px;font-family:'Outfit',Helvetica,Arial,sans-serif;color:%5$s;">
                            <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:800;">Cambia tu contraseña</h1>
                            <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">Hola, %6$s:</p>
                            <p style="margin:0 0 24px;font-size:16px;line-height:1.5;">Pulsa el botón para poner una contraseña nueva en PorrApp.</p>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td align="center" bgcolor="%5$s" style="border-radius:6px;">
                                  <a href="%7$s" style="display:inline-block;padding:14px 28px;font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:%2$s;text-decoration:none;border-radius:6px;">Cambiar mi contraseña</a>
                                </td>
                              </tr>
                            </table>
                            <p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:%8$s;">Caduca en 30 minutos y solo sirve una vez. Si no lo has pedido tú, ignora este correo: tu contraseña no cambia.</p>
                            <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:%8$s;">Si el botón no funciona, copia este enlace en el navegador:<br><a href="%7$s" style="color:%8$s;word-break:break-all;">%7$s</a></p>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding-top:20px;font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:12px;color:%8$s;">
                            <a href="%3$s" style="color:%8$s;text-decoration:none;font-weight:700;">PorrApp</a> · Porras con amigos · %9$s
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                </body>
                </html>
                """.formatted(SUBJECT, PAPER, baseUrl, CARD, INK, name, link, MUTED, host);
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
