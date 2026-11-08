package com.porra.mundial.controller;

import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.service.league.LeagueService;
import com.porra.mundial.service.league.InvitationImageRenderer;
import com.porra.mundial.service.account.ProfileImageService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.regex.Pattern;

/** Serves crawler-readable Open Graph metadata and invitation-card images for league links. */
@RestController
@RequiredArgsConstructor
public class JoinPreviewController {
    /** Nombre de la competición en una liga que junta partidos de varias. */
    private static final String MULTI_COMPETITION = "Varias competiciones";


    /** Dirección pública de la web; la fija {@code app.public-base-url}. */
    @Value("${app.public-base-url:https://porrapp.app}")
    private String baseUrl = "https://porrapp.app";
    private static final String DEFAULT_TITLE = "Invitación a una porra";
    private static final String DEFAULT_DESCRIPTION = "Porra de fútbol";
    private static final String IMAGE_VERSION = "3";

    private final LeagueService leagueService;
    private final ProfileImageService profileImageService;
    private final InvitationImageRenderer imageRenderer;

    @GetMapping(value = "/join/{code}", produces = MediaType.TEXT_HTML_VALUE)
    public String preview(@PathVariable String code) throws IOException {
        String html = new ClassPathResource("static/index.html")
                .getContentAsString(StandardCharsets.UTF_8);

        String canonicalUrl = baseUrl + "/join/" + encodePathSegment(code);
        String title = DEFAULT_TITLE;
        String description = DEFAULT_DESCRIPTION;
        String imageAlt = "Invitación a una porra de PorrApp";
        String imageVersion = IMAGE_VERSION;

        Optional<League> leagueOptional = findLeague(code);
        if (leagueOptional.isPresent()) {
            League league = leagueOptional.get();
            String leagueName = league.getName() == null || league.getName().isBlank()
                    ? "Mi liga"
                    : league.getName();
            // El nombre de la liga arriba; competición y formato debajo.
            title = leagueName;
            imageAlt = leagueName;
            description = "Porra de fútbol";

            Optional<Edition> activeEdition = leagueService.findActiveEdition(league.getId());
            if (activeEdition.isPresent() && activeEdition.get().getCompetition() != null) {
                String competitionName = activeEdition.get().getTennisScope() != null
                        ? activeEdition.get().getTennisScope().label()
                        : activeEdition.get().isMultiCompetition() ? MULTI_COMPETITION
                        : activeEdition.get().getCompetition().getName();
                String format = activeEdition.get().getPoolFormat() != null
                        ? formatLabel(activeEdition.get().getPoolFormat().name())
                        : null;
                description = competitionName + (format != null ? " · " + format : "");
            }
            if (league.getImageUpdatedAt() != null) {
                imageVersion += "-" + league.getImageUpdatedAt().getEpochSecond();
            }
        }

        // Mismo PNG que se adjunta al compartir por WhatsApp, con versión para
        // evitar que WhatsApp reutilice una vista previa antigua en caché.
        String imageUrl = baseUrl + "/join/" + encodePathSegment(code) + "/image.png?v=" + imageVersion;

        html = replaceTitle(html, title);
        html = replaceMeta(html, "property", "og:title", title);
        html = replaceMeta(html, "property", "og:description", description);
        html = replaceMeta(html, "property", "og:type", "website");
        html = replaceMeta(html, "property", "og:url", canonicalUrl);
        html = replaceMeta(html, "property", "og:image", imageUrl);
        html = replaceMeta(html, "property", "og:image:type", "image/png");
        html = replaceMeta(html, "property", "og:image:width", Integer.toString(InvitationImageRenderer.WIDTH));
        html = replaceMeta(html, "property", "og:image:height", Integer.toString(InvitationImageRenderer.HEIGHT));
        html = replaceMeta(html, "property", "og:image:alt", imageAlt);
        html = replaceMeta(html, "property", "og:site_name", "PorrApp");
        html = replaceMeta(html, "property", "og:locale", "es_ES");
        html = replaceMeta(html, "name", "description", description);
        html = replaceMeta(html, "name", "twitter:card", "summary_large_image");
        html = replaceMeta(html, "name", "twitter:title", title);
        html = replaceMeta(html, "name", "twitter:description", description);
        html = replaceMeta(html, "name", "twitter:image", imageUrl);
        html = replaceMeta(html, "name", "twitter:image:alt", imageAlt);
        return html;
    }

    /** Public PNG endpoint used by WhatsApp and other Open Graph crawlers. */
    @GetMapping(value = "/join/{code}/image.png", produces = MediaType.IMAGE_PNG_VALUE)
    public byte[] invitationImage(@PathVariable String code) throws IOException {
        Optional<League> leagueOptional = findLeague(code);
        if (leagueOptional.isEmpty()) {
            // Todos los códigos inexistentes comparten la misma imagen genérica.
            return imageRenderer.generic();
        }
        League league = leagueOptional.get();
        String name = league.getName() == null || league.getName().isBlank() ? "Mi liga" : league.getName();
        String competition = "Fútbol";
        String format = "Cuadro completo";
        Optional<Edition> activeEdition = leagueService.findActiveEdition(league.getId());
        if (activeEdition.isPresent()) {
            Edition edition = activeEdition.get();
            if (edition.getTennisScope() != null) {
                competition = edition.getTennisScope().label();
            } else if (edition.isMultiCompetition()) {
                competition = MULTI_COMPETITION;
            } else if (edition.getCompetition() != null && edition.getCompetition().getName() != null) {
                competition = edition.getCompetition().getName();
            }
            if (edition.getPoolFormat() != null) {
                format = formatLabel(edition.getPoolFormat().name());
            }
        }
        // La tarjeta se vuelve a dibujar solo si cambian el nombre, los datos o la foto.
        String cacheKey = league.getId() + "|" + name + "|" + competition + "|" + format + "|" + league.getImageUpdatedAt();
        return imageRenderer.render(cacheKey, new InvitationImageRenderer.Card(name, competition, format),
                () -> profileImageService.getLeagueImage(league.getId())
                        .map(ProfileImageService.StoredImage::data).orElse(null));
    }

    private Optional<League> findLeague(String code) {
        return leagueService.getLeagueByJoinCode(code.trim().toUpperCase());
    }

    private String encodePathSegment(String value) {
        return value.replace("%", "%25").replace(" ", "%20")
                .replace("\"", "%22").replace("<", "%3C").replace(">", "%3E");
    }

    private String formatLabel(String format) {
        return switch (format) {
            case "MATCH_DAY" -> "Por jornadas";
            case "SURVIVOR" -> "Superviviente";
            case "GRAND_PRIX" -> "Grandes Premios";
            case "FULL_BRACKET" -> "Cuadro completo";
            case "KNOCKOUTS_ONLY" -> "Eliminatorias";
            default -> format.toLowerCase().replace('_', ' ');
        };
    }

    private String replaceTitle(String html, String title) {
        return html.replaceFirst("(?is)<title>.*?</title>",
                java.util.regex.Matcher.quoteReplacement("<title>" + HtmlUtils.htmlEscape(title) + "</title>"));
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
