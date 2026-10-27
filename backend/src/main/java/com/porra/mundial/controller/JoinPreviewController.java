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

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.regex.Pattern;

/** Serves crawler-readable Open Graph metadata for league invitation links. */
@RestController
@RequiredArgsConstructor
public class JoinPreviewController {

    private static final String BASE_URL = "https://porra.raclos.es";
    private static final String DEFAULT_TITLE = "Invitación a una porra | PorrApp";
    private static final String DEFAULT_DESCRIPTION = "Únete a esta porra y compite con tus amigos.";
    private static final String DEFAULT_IMAGE = "/world-cup-icon.png";

    private final LeagueRepository leagueRepository;
    private final EditionRepository editionRepository;

    @GetMapping(value = "/join/{code}", produces = MediaType.TEXT_HTML_VALUE)
    public String preview(@PathVariable String code) throws IOException {
        String html = new ClassPathResource("static/index.html")
                .getContentAsString(StandardCharsets.UTF_8);

        String canonicalUrl = BASE_URL + "/join/" + encodePathSegment(code);
        String title = DEFAULT_TITLE;
        String description = DEFAULT_DESCRIPTION;
        String imageUrl = BASE_URL + DEFAULT_IMAGE;

        Optional<League> leagueOptional = leagueRepository.findByJoinCode(code.trim().toUpperCase());
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

            if (league.getImageUrl() != null && !league.getImageUrl().isBlank()) {
                imageUrl = absoluteUrl(league.getImageUrl());
            }
        }

        html = replaceTitle(html, title);
        html = replaceMeta(html, "property", "og:title", title);
        html = replaceMeta(html, "property", "og:description", description);
        html = replaceMeta(html, "property", "og:url", canonicalUrl);
        html = replaceMeta(html, "property", "og:image", imageUrl);
        html = replaceMeta(html, "name", "description", description);
        html = replaceMeta(html, "name", "twitter:card", "summary_large_image");
        html = replaceMeta(html, "name", "twitter:title", title);
        html = replaceMeta(html, "name", "twitter:description", description);
        html = replaceMeta(html, "name", "twitter:image", imageUrl);
        return html;
    }

    private String absoluteUrl(String imageUrl) {
        if (imageUrl.startsWith("https://") || imageUrl.startsWith("http://")) {
            return imageUrl;
        }
        return BASE_URL + (imageUrl.startsWith("/") ? imageUrl : "/" + imageUrl);
    }

    private String encodePathSegment(String value) {
        return value.replace("%", "%25").replace(" ", "%20")
                .replace("\"", "%22").replace("<", "%3C").replace(">", "%3E");
    }

    private String formatLabel(String format) {
        return switch (format) {
            case "MATCH_DAY" -> "por jornadas";
            case "FULL_BRACKET" -> "cuadro completo";
            case "KNOCKOUTS_ONLY" -> "eliminatorias";
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
