package app.porrapp.service.account;

import app.porrapp.service.notification.EmailSender.Email;

import java.util.List;

/**
 * Plantilla de los correos de la cuenta (código de registro, cambiar la contraseña, avisos), con la
 * imagen de PorrApp: papel crema, tinta oscura y el logo. HTML de tablas y estilos en línea, que es
 * lo único que respetan todos los clientes de correo; siempre va también en texto plano.
 */
final class AccountEmail {

    private static final String PAPER = "#f3ecdc";
    private static final String CARD = "#fffdf7";
    private static final String INK = "#111827";
    private static final String MUTED = "#4b5563";
    private static final String FONT = "'Outfit',Helvetica,Arial,sans-serif";

    /**
     * @param subject      asunto (y título de la página)
     * @param preheader    resumen que muestran los clientes junto al asunto
     * @param title        encabezado del correo
     * @param name         nombre de la cuenta para el saludo, o {@code null} para un saludo sin nombre
     * @param paragraphs   párrafos en texto plano (se escapan)
     * @param code         código grande que copiar, o {@code null}
     * @param buttonLabel  texto del botón
     * @param buttonLink   enlace del botón
     * @param note         letra pequeña bajo el botón
     * @param linkFallback si se repite el enlace en texto por si el botón no funciona
     */
    record Content(String subject, String preheader, String title, String name, List<String> paragraphs,
                   String code, String buttonLabel, String buttonLink, String note, boolean linkFallback) {
    }

    private AccountEmail() {
    }

    static Email build(String to, Content content, String baseUrl) {
        return new Email(to, content.subject(), text(content), html(content, baseUrl));
    }

    private static String text(Content c) {
        StringBuilder text = new StringBuilder();
        text.append(c.name() != null ? "Hola, " + c.name() + ":" : "Hola:").append("\n\n");
        for (String paragraph : c.paragraphs()) {
            text.append(paragraph).append("\n\n");
        }
        if (c.code() != null) {
            text.append(c.code()).append("\n\n");
        }
        text.append(c.buttonLabel()).append(":\n").append(c.buttonLink()).append("\n\n");
        text.append(c.note()).append("\n\nPorrApp\n");
        return text.toString();
    }

    private static String html(Content c, String baseUrl) {
        String host = baseUrl.replaceFirst("^https?://", "");
        String greeting = c.name() != null ? "Hola, " + escape(c.name()) + ":" : "Hola:";
        StringBuilder body = new StringBuilder();
        for (String paragraph : c.paragraphs()) {
            body.append("<p style=\"margin:0 0 16px;font-size:16px;line-height:1.5;\">")
                    .append(escape(paragraph)).append("</p>\n");
        }
        if (c.code() != null) {
            body.append("<p style=\"margin:8px 0 24px;font-family:'Courier New',monospace;font-size:34px;font-weight:700;")
                    .append("letter-spacing:8px;text-align:center;background:").append(PAPER)
                    .append(";border:2px dashed ").append(INK).append(";border-radius:6px;padding:14px 0;\">")
                    .append(escape(c.code())).append("</p>\n");
        }
        String link = escape(c.buttonLink());
        String fallback = c.linkFallback()
                ? "<p style=\"margin:16px 0 0;font-size:12px;line-height:1.5;color:" + MUTED
                + ";\">Si el botón no funciona, copia este enlace en el navegador:<br><a href=\"" + link
                + "\" style=\"color:" + MUTED + ";word-break:break-all;\">" + link + "</a></p>"
                : "";
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
                <div style="display:none;max-height:0;overflow:hidden;opacity:0;">%3$s</div>
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="background:%2$s;">
                  <tr>
                    <td align="center" style="padding:32px 16px;">
                      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
                        <tr>
                          <td align="center" style="padding-bottom:20px;">
                            <img src="%4$s/icon-paper-192.png" width="72" height="72" alt="PorrApp" style="display:block;border:0;border-radius:16px;">
                          </td>
                        </tr>
                        <tr>
                          <td style="background:%5$s;border:2px solid %6$s;border-radius:6px;padding:32px 28px;font-family:%7$s;color:%6$s;">
                            <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:800;">%8$s</h1>
                            <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">%9$s</p>
                            %10$s
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td align="center" bgcolor="%6$s" style="border-radius:6px;">
                                  <a href="%11$s" style="display:inline-block;padding:14px 28px;font-family:%7$s;font-size:16px;font-weight:700;color:%2$s;text-decoration:none;border-radius:6px;">%12$s</a>
                                </td>
                              </tr>
                            </table>
                            <p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:%13$s;">%14$s</p>
                            %15$s
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding-top:20px;font-family:%7$s;font-size:12px;color:%13$s;">
                            <a href="%4$s" style="color:%13$s;text-decoration:none;font-weight:700;">PorrApp</a> · Porras con amigos · %16$s
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                </body>
                </html>
                """.formatted(escape(c.subject()), PAPER, escape(c.preheader()), baseUrl, CARD, INK, FONT,
                escape(c.title()), greeting, body, link, escape(c.buttonLabel()), MUTED, escape(c.note()),
                fallback, host);
    }

    static String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
