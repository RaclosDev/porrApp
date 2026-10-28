package com.porra.mundial.controller;

import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.LeagueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

import javax.imageio.ImageIO;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.regex.Pattern;

/** Serves crawler-readable Open Graph metadata and invitation-card images for league links. */
@RestController
@RequiredArgsConstructor
public class JoinPreviewController {

    private static final String BASE_URL = "https://porra.raclos.es";
    private static final String DEFAULT_TITLE = "Invitación a una porra | PorrApp";
    private static final String DEFAULT_DESCRIPTION = "Únete a esta porra y compite con tus amigos.";
    private static final int IMAGE_WIDTH = 1200;
    private static final int IMAGE_HEIGHT = 360;

    private final LeagueRepository leagueRepository;
    private final EditionRepository editionRepository;

    @GetMapping(value = "/join/{code}", produces = MediaType.TEXT_HTML_VALUE)
    public String preview(@PathVariable String code) throws IOException {
        String html = new ClassPathResource("static/index.html")
                .getContentAsString(StandardCharsets.UTF_8);

        String canonicalUrl = BASE_URL + "/join/" + encodePathSegment(code);
        String title = DEFAULT_TITLE;
        String description = DEFAULT_DESCRIPTION;
        String imageUrl = BASE_URL + "/join/" + encodePathSegment(code) + "/image.png";

        Optional<League> leagueOptional = findLeague(code);
        if (leagueOptional.isPresent()) {
            League league = leagueOptional.get();
            title = league.getName();

            Optional<Edition> activeEdition = editionRepository.findByLeagueIdAndStatus(league.getId(), "ACTIVE");
            if (activeEdition.isPresent() && activeEdition.get().getCompetition() != null) {
                String competitionName = activeEdition.get().getCompetition().getName();
                String format = activeEdition.get().getPoolFormat() != null
                        ? activeEdition.get().getPoolFormat().name()
                        : null;
                description = competitionName
                        + (format != null ? " · " + formatLabel(format) : "")
                        + " · Únete a la porra en PorrApp.";
            } else {
                description = "Únete a la porra \"" + league.getName() + "\" en PorrApp.";
            }
        }

        html = replaceTitle(html, title);
        html = replaceMeta(html, "property", "og:title", title);
        html = replaceMeta(html, "property", "og:description", description);
        html = replaceMeta(html, "property", "og:type", "website");
        html = replaceMeta(html, "property", "og:url", canonicalUrl);
        html = replaceMeta(html, "property", "og:image", imageUrl);
        html = replaceMeta(html, "property", "og:image:width", Integer.toString(IMAGE_WIDTH));
        html = replaceMeta(html, "property", "og:image:height", Integer.toString(IMAGE_HEIGHT));
        html = replaceMeta(html, "name", "description", description);
        html = replaceMeta(html, "name", "twitter:card", "summary_large_image");
        html = replaceMeta(html, "name", "twitter:title", title);
        html = replaceMeta(html, "name", "twitter:description", description);
        html = replaceMeta(html, "name", "twitter:image", imageUrl);
        return html;
    }

    /** Public PNG endpoint used by WhatsApp and other Open Graph crawlers. */
    @GetMapping(value = "/join/{code}/image.png", produces = MediaType.IMAGE_PNG_VALUE)
    public byte[] invitationImage(@PathVariable String code) throws IOException {
        String name = "Invitación a una porra";
        String competition = "Fútbol";
        String format = "Cuadro completo";
        String leagueImageUrl = null;

        Optional<League> leagueOptional = findLeague(code);
        if (leagueOptional.isPresent()) {
            League league = leagueOptional.get();
            name = league.getName() == null || league.getName().isBlank() ? "Mi liga" : league.getName();
            leagueImageUrl = league.getImageUrl();
            Optional<Edition> activeEdition = editionRepository.findByLeagueIdAndStatus(league.getId(), "ACTIVE");
            if (activeEdition.isPresent()) {
                Edition edition = activeEdition.get();
                if (edition.getCompetition() != null && edition.getCompetition().getName() != null) {
                    competition = edition.getCompetition().getName();
                }
                if (edition.getPoolFormat() != null) {
                    format = formatLabel(edition.getPoolFormat().name());
                }
            }
        }

        // ARGB conserva la transparencia del lienzo y de logotipos PNG con fondo transparente.
        BufferedImage image = new BufferedImage(IMAGE_WIDTH, IMAGE_HEIGHT, BufferedImage.TYPE_INT_ARGB);
        Graphics2D graphics = image.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            // No pintar un fondo opaco: el lienzo debe seguir siendo transparente.

            // Reproduce la tarjeta original: foto de la liga a la izquierda y título + pills a la derecha.
            boolean photoLoaded = drawLeaguePhoto(graphics, leagueImageUrl);
            int textX = photoLoaded ? 356 : 40;
            int maxTextWidth = photoLoaded ? 800 : 1120;

            graphics.setColor(Color.WHITE);
            graphics.setFont(new Font("Arial", Font.BOLD, 54));
            drawFittedText(graphics, name, textX, 112, maxTextWidth, 54);

            drawPill(graphics, competition, textX, 150,
                    new Color(162, 155, 254, 41), new Color(162, 155, 254, 166),
                    new Color(196, 181, 253), 26, maxTextWidth);
            drawPill(graphics, format, textX, 214,
                    new Color(0, 210, 211, 31), new Color(0, 210, 211, 166),
                    new Color(0, 210, 211), 26, maxTextWidth);
        } finally {
            graphics.dispose();
        }

        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", output);
            return output.toByteArray();
        }
    }

    private boolean drawLeaguePhoto(Graphics2D graphics, String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return false;
        }

        HttpURLConnection connection = null;
        try {
            String resolvedUrl = imageUrl.startsWith("https://") || imageUrl.startsWith("http://")
                    ? imageUrl
                    : BASE_URL + (imageUrl.startsWith("/") ? imageUrl : "/" + imageUrl);
            connection = (HttpURLConnection) new URL(resolvedUrl).openConnection();
            connection.setConnectTimeout(2000);
            connection.setReadTimeout(3000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", "image/*");
            connection.connect();

            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                return false;
            }

            BufferedImage photo = ImageIO.read(connection.getInputStream());
            if (photo == null) {
                return false;
            }

            int x = 36;
            int y = 36;
            int size = 288;
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

            graphics.setClip(new RoundRectangle2D.Float(x, y, size, size, 22, 22));
            graphics.drawImage(square, x, y, null);
            graphics.setClip(null);
            return true;
        } catch (IOException | RuntimeException exception) {
            // Si la foto no está disponible, conservar la tarjeta con el título y las pills.
            return false;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private Optional<League> findLeague(String code) {
        return leagueRepository.findByJoinCode(code.trim().toUpperCase());
    }

    private void drawPill(Graphics2D graphics, String text, int x, int y,
                          Color fill, Color stroke, Color foreground, int fontSize, int maxWidth) {
        graphics.setFont(new Font("Arial", Font.BOLD, fontSize));
        int width = Math.min(graphics.getFontMetrics().stringWidth(text) + 34, maxWidth);
        int height = 48;
        graphics.setColor(fill);
        graphics.fillRoundRect(x, y, width, height, 24, 24);
        graphics.setColor(stroke);
        graphics.setStroke(new BasicStroke(2));
        graphics.drawRoundRect(x, y, width, height, 24, 24);
        graphics.setColor(foreground);
        graphics.setFont(new Font("Arial", Font.BOLD, fontSize));
        graphics.drawString(text, x + 17, y + 31);
    }

    private void drawFittedText(Graphics2D graphics, String value, int x, int y, int maxWidth, int initialSize) {
        int size = initialSize;
        Font font = new Font(Font.SANS_SERIF, Font.BOLD, size);
        graphics.setFont(font);
        while (graphics.getFontMetrics().stringWidth(value) > maxWidth && size > 30) {
            size -= 2;
            font = new Font(Font.SANS_SERIF, Font.BOLD, size);
            graphics.setFont(font);
        }
        String fitted = value;
        while (graphics.getFontMetrics().stringWidth(fitted) > maxWidth && fitted.length() > 4) {
            fitted = fitted.substring(0, fitted.length() - 2) + "…";
        }
        graphics.drawString(fitted, x, y);
    }

    private String encodePathSegment(String value) {
        return value.replace("%", "%25").replace(" ", "%20")
                .replace("\"", "%22").replace("<", "%3C").replace(">", "%3E");
    }

    private String formatLabel(String format) {
        return switch (format) {
            case "MATCH_DAY" -> "Por jornadas";
            case "FULL_BRACKET" -> "Cuadro completo";
            case "KNOCKOUTS_ONLY" -> "Eliminatorias";
            default -> format.toLowerCase().replace('_', ' ');
        };
    }

    private String replaceTitle(String html, String title) {
        return html.replaceFirst("(?is)<title>.*?</title>",
                "<title>" + HtmlUtils.htmlEscape(title) + "</title>");
    }

    private String replaceMeta(String html, String attribute, String key, String value) {
        String escapedKey = Pattern.quote(key);
        String pattern = "(?is)<meta\\s+[^>]*" + attribute + "=[\"']" + escapedKey
                + "[\"'][^>]*>";
        String replacement = "<meta " + attribute + "=\"" + key + "\" content=\""
                + HtmlUtils.htmlEscape(value) + "\" />";
        return html.replaceFirst(pattern, java.util.regex.Matcher.quoteReplacement(replacement));
    }
}
