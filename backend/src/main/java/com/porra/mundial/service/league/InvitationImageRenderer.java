package com.porra.mundial.service.league;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontFormatException;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Path2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.time.Duration;
import java.util.Locale;
import java.util.function.Supplier;

/** Dibuja la tarjeta PNG de una invitación (Open Graph, WhatsApp) y guarda las ya dibujadas. */
@Component
public class InvitationImageRenderer {

    public static final int WIDTH = 1200;
    public static final int HEIGHT = 630;

    private static final Color PAPER = new Color(243, 236, 220);
    private static final Color INK = new Color(17, 24, 39);
    private static final Color MARKER = new Color(11, 95, 116);
    private static final Font POSTER = loadFont("fonts/anton/Anton-Regular.ttf");
    private static final Font HANDWRITING = loadFont("fonts/permanent-marker/PermanentMarker-Regular.ttf");
    private static final String GENERIC_KEY = "generic";
    private static final Card GENERIC_CARD = new Card("Invitación a una porra", "Fútbol", "Cuadro completo");

    /** Lo que se escribe en la tarjeta. */
    public record Card(String name, String competition, String format) {
    }

    /** Imágenes ya dibujadas; una liga ocupa unos 100 KB. */
    private final Cache<String, byte[]> rendered = Caffeine.newBuilder()
            .maximumSize(200)
            .expireAfterAccess(Duration.ofHours(6))
            .build();

    private final String host;

    public InvitationImageRenderer(@Value("${app.public-base-url:https://porrapp.app}") String baseUrl) {
        this.host = URI.create(baseUrl).getHost();
    }

    /** La tarjeta común de los códigos que no existen. */
    public byte[] generic() {
        return rendered.get(GENERIC_KEY, key -> draw(GENERIC_CARD, null));
    }

    /**
     * La tarjeta de una liga. Dibujarla cuesta CPU: se reutiliza mientras no cambie {@code cacheKey},
     * y la foto solo se carga si hay que dibujarla.
     */
    public byte[] render(String cacheKey, Card card, Supplier<byte[]> leaguePhoto) {
        return rendered.get(cacheKey, key -> draw(card, leaguePhoto.get()));
    }

    private byte[] draw(Card card, byte[] leagueImage) {
        // ARGB conserva la transparencia del lienzo y de logotipos PNG con fondo transparente.
        BufferedImage image = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_ARGB);
        Graphics2D graphics = image.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            graphics.setColor(new Color(15, 23, 42));
            graphics.fillRect(0, 0, WIDTH, HEIGHT);

            // Solo se inclina el soporte, como en la web: texto y foto permanecen rectos.
            graphics.setColor(new Color(216, 207, 185));
            graphics.fillRoundRect(42, 66, 1122, 514, 6, 6);
            Path2D sheet = new Path2D.Double();
            sheet.moveTo(32, 60);
            sheet.lineTo(1152, 48);
            sheet.lineTo(1152, 558);
            sheet.lineTo(32, 570);
            sheet.closePath();
            graphics.setColor(PAPER);
            graphics.fill(sheet);
            graphics.setColor(new Color(255, 230, 140, 220));
            graphics.fillPolygon(new int[]{520, 672, 674, 522}, new int[]{32, 26, 66, 72}, 4);

            graphics.setColor(MARKER);
            graphics.setFont(HANDWRITING.deriveFont(32f));
            graphics.drawString("PorrApp", 72, 116);

            if (!drawLeaguePhoto(graphics, leagueImage)) {
                graphics.setColor(new Color(231, 223, 206));
                graphics.fillRoundRect(72, 162, 244, 244, 6, 6);
                graphics.setColor(MARKER);
                graphics.setStroke(new BasicStroke(3));
                graphics.drawRoundRect(90, 180, 208, 208, 4, 4);
                graphics.setFont(POSTER.deriveFont(48f));
                graphics.drawString("TU LIGA", 120, 305);
            }

            graphics.setColor(INK);
            graphics.setFont(POSTER.deriveFont(64f));
            drawFittedText(graphics, card.name().toUpperCase(Locale.ROOT), 364, 224, 744, 64);
            graphics.setFont(POSTER.deriveFont(32f));
            drawFittedText(graphics, card.competition().toUpperCase(Locale.ROOT), 364, 293, 744, 32);
            drawStamp(graphics, card.format().toUpperCase(Locale.ROOT), 364, 332, 744);

            graphics.setColor(new Color(17, 24, 39, 45));
            graphics.setStroke(new BasicStroke(2));
            graphics.drawLine(72, 454, 1112, 454);
            graphics.setColor(MARKER);
            graphics.setFont(HANDWRITING.deriveFont(32f));
            graphics.drawString("Te han invitado a jugar.", 72, 520);
            graphics.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 22));
            graphics.setColor(INK);
            graphics.drawString(host, 944, 520);
        } finally {
            graphics.dispose();
        }

        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", output);
            return output.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private boolean drawLeaguePhoto(Graphics2D graphics, byte[] imageData) {
        if (imageData == null || imageData.length == 0) {
            return false;
        }
        try (ByteArrayInputStream input = new ByteArrayInputStream(imageData)) {
            BufferedImage photo = ImageIO.read(input);
            if (photo == null) {
                return false;
            }

            int x = 72;
            int y = 162;
            int size = 244;
            double scale = Math.max((double) size / photo.getWidth(), (double) size / photo.getHeight());
            int width = (int) Math.round(photo.getWidth() * scale);
            int height = (int) Math.round(photo.getHeight() * scale);
            int cropX = (width - size) / 2;
            int cropY = (height - size) / 2;

            BufferedImage square = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
            Graphics2D photoGraphics = square.createGraphics();
            try {
                photoGraphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
                        RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                photoGraphics.drawImage(photo, -cropX, -cropY, width, height, null);
            } finally {
                photoGraphics.dispose();
            }

            graphics.setColor(Color.WHITE);
            graphics.fillRoundRect(x - 6, y - 6, size + 12, size + 12, 6, 6);
            graphics.setClip(new RoundRectangle2D.Float(x, y, size, size, 4, 4));
            graphics.drawImage(square, x, y, null);
            graphics.setClip(null);
            return true;
        } catch (IOException | RuntimeException exception) {
            // Si la foto no está disponible, conservar la tarjeta con el nombre de la liga.
            return false;
        }
    }

    static Font loadFont(String path) {
        try (var stream = new ClassPathResource(path).getInputStream()) {
            return Font.createFont(Font.TRUETYPE_FONT, stream);
        } catch (IOException | FontFormatException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "No se pudo generar la imagen de invitación.", exception);
        }
    }

    private void drawStamp(Graphics2D graphics, String text, int x, int y, int maxWidth) {
        graphics.setFont(POSTER.deriveFont(28f));
        int width = Math.min(graphics.getFontMetrics().stringWidth(text) + 32, maxWidth);
        graphics.setColor(MARKER);
        graphics.setStroke(new BasicStroke(3));
        graphics.drawRoundRect(x, y, width, 52, 4, 4);
        drawFittedText(graphics, text, x + 16, y + 36, width - 32, 28);
    }

    private void drawFittedText(Graphics2D graphics, String value, int x, int y, int maxWidth, int initialSize) {
        int size = initialSize;
        Font baseFont = graphics.getFont();
        Font font = baseFont.deriveFont((float) size);
        graphics.setFont(font);
        while (graphics.getFontMetrics().stringWidth(value) > maxWidth && size > 30) {
            size -= 2;
            font = baseFont.deriveFont((float) size);
            graphics.setFont(font);
        }
        String fitted = value;
        while (graphics.getFontMetrics().stringWidth(fitted) > maxWidth && fitted.length() > 4) {
            fitted = fitted.substring(0, fitted.length() - 2) + "…";
        }
        graphics.drawString(fitted, x, y);
    }
}
