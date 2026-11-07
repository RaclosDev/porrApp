package com.porra.mundial.service.tournament;

import com.porra.mundial.service.prediction.PredictableBracket;
import com.porra.mundial.service.prediction.ScoreInvalidationService;
import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.PredictionDataConverter;
import com.porra.mundial.model.PredictionLockMode;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.PredictionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Pasa una liga con cuadro personalizado a una competición oficial con cuadro propio (Worlds de LoL…):
 * empareja los cruces de la primera ronda por los nombres de los equipos, traduce las predicciones a
 * los nombres oficiales y apunta la edición a la competición oficial. La competición personalizada se
 * conserva hasta que se borre la liga.
 */
@Service
@RequiredArgsConstructor
public class OfficialCompetitionLinkService {
    private final EditionRepository editionRepository;
    private final CompetitionRepository competitionRepository;
    private final MatchRepository matchRepository;
    private final PredictionRepository predictionRepository;
    private final ScoreInvalidationService scoreInvalidationService;
    private static final PredictionDataConverter JSON = new PredictionDataConverter();

    @Transactional
    @CacheEvict(value = {"userGroups", "groupById", "groupByCode", "matches", "matchRadar"}, allEntries = true)
    public Edition link(Long leagueId, String email, Long competitionId) {
        Edition edition = editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        if (edition.getLeague().getAdminUser() == null
                || !email.equalsIgnoreCase(edition.getLeague().getAdminUser().getGoogleEmail())) {
            throw BusinessException.forbidden("Solo el administrador puede cambiar la competición");
        }
        Competition custom = edition.getCompetition();
        if (custom.getOwnerLeague() == null || !leagueId.equals(custom.getOwnerLeague().getId())) {
            throw BusinessException.badRequest("Esta liga ya juega una competición oficial");
        }
        if (PoolFormat.isMatchBased(edition.getPoolFormat())) {
            throw BusinessException.badRequest("Solo se pueden pasar ligas de cuadro");
        }
        Competition official = competitionRepository.findById(competitionId)
                .filter(Competition::hasOwnBracket)
                .orElseThrow(() -> BusinessException.badRequest("Esa competición no tiene un cuadro propio"));

        List<Match> customFirst = firstRound(custom);
        List<Match> officialFirst = firstRound(official);
        if (officialFirst.isEmpty()) {
            throw BusinessException.badRequest("La competición oficial aún no tiene cruces");
        }
        Map<String, String> names = mapTeams(customFirst, officialFirst);

        for (Prediction prediction : predictionRepository.findByEditionLeagueId(leagueId)) {
            PredictionDataDTO data = prediction.getBracketData();
            if (data == null || data.getCustomRounds() == null || data.getCustomRounds().isEmpty()) continue;
            PredictionDataDTO copy = JSON.convertToEntityAttribute(JSON.convertToDatabaseColumn(data));
            translate(copy, names, officialFirst);
            prediction.setBracketData(copy);
        }
        predictionRepository.flush();

        // Se conserva el modo de cierre elegido; las fechas pasan a ser las de los cruces oficiales.
        PredictionLockMode mode = edition.getLockMode() == null ? PredictionLockMode.FIXED_DATE : edition.getLockMode();
        int offset = mode == PredictionLockMode.FIXED_DATE ? 0 : Math.max(0, edition.getLockOffsetMinutes());
        Instant firstMatch = officialFirst.stream().map(Match::getMatchDate).filter(Objects::nonNull)
                .min(Instant::compareTo).orElse(null);
        Instant lockDate = switch (mode) {
            case FIXED_DATE -> edition.getLockDate() != null ? edition.getLockDate() : firstMatch;
            case FIRST_MATCH -> firstMatch == null ? null : firstMatch.minus(offset, ChronoUnit.MINUTES);
            default -> null;
        };
        edition.setCompetition(official);
        edition.setPoolFormat(PoolFormat.KNOCKOUTS_ONLY);
        edition.setLockMode(mode);
        edition.setLockOffsetMinutes(offset);
        edition.setLockDate(lockDate);
        Edition saved = editionRepository.save(edition);
        scoreInvalidationService.invalidateEdition(saved.getId());
        return saved;
    }

    private List<Match> firstRound(Competition competition) {
        List<List<Match>> rounds = PredictableBracket.rounds(competition, matchRepository.findByCompetitionId(competition.getId()));
        return rounds.isEmpty() ? List.of() : rounds.get(0);
    }

    /** Nombre personalizado → nombre oficial, emparejando cada cruce con el cruce oficial más parecido. */
    static Map<String, String> mapTeams(List<Match> custom, List<Match> official) {
        if (custom.size() != official.size()) {
            throw BusinessException.badRequest("El cuadro tiene " + custom.size() + " cruces y el oficial "
                    + official.size());
        }
        record Candidate(int custom, int official, boolean swapped, int score) {}
        List<Candidate> candidates = new ArrayList<>();
        for (int i = 0; i < custom.size(); i++) {
            String home = name(custom.get(i).getHomeTeam());
            String away = name(custom.get(i).getAwayTeam());
            for (int j = 0; j < official.size(); j++) {
                String officialHome = name(official.get(j).getHomeTeam());
                String officialAway = name(official.get(j).getAwayTeam());
                int straight = pairScore(home, away, officialHome, officialAway);
                int swapped = pairScore(home, away, officialAway, officialHome);
                if (Math.max(straight, swapped) > 0) {
                    candidates.add(new Candidate(i, j, swapped > straight, Math.max(straight, swapped)));
                }
            }
        }
        candidates.sort((left, right) -> Integer.compare(right.score(), left.score()));
        Set<Integer> usedCustom = new HashSet<>();
        Set<Integer> usedOfficial = new HashSet<>();
        Map<String, String> names = new HashMap<>();
        for (Candidate candidate : candidates) {
            if (usedCustom.contains(candidate.custom()) || usedOfficial.contains(candidate.official())) continue;
            usedCustom.add(candidate.custom());
            usedOfficial.add(candidate.official());
            Match from = custom.get(candidate.custom());
            Match to = official.get(candidate.official());
            String toHome = name(to.getHomeTeam());
            String toAway = name(to.getAwayTeam());
            names.put(name(from.getHomeTeam()), candidate.swapped() ? toAway : toHome);
            if (from.getAwayTeam() != null) names.put(name(from.getAwayTeam()), candidate.swapped() ? toHome : toAway);
        }
        if (usedCustom.size() != custom.size()) {
            List<String> missing = new ArrayList<>();
            for (int i = 0; i < custom.size(); i++) {
                if (!usedCustom.contains(i)) {
                    missing.add(name(custom.get(i).getHomeTeam()) + " - " + name(custom.get(i).getAwayTeam()));
                }
            }
            throw BusinessException.badRequest("No encuentro en la competición oficial estos cruces: "
                    + String.join(", ", missing));
        }
        return names;
    }

    /** Parecido de un cruce: basta con reconocer a uno de los dos equipos (el otro es su rival). */
    private static int pairScore(String home, String away, String officialHome, String officialAway) {
        int first = similarity(home, officialHome);
        int second = similarity(away, officialAway);
        return first == 0 && second == 0 ? 0 : first + second;
    }

    /** 4 igual, 3 prefijo, 2 siglas, 1 letras en orden con la misma inicial (BLG ↔ Bilibili Gaming). */
    static int similarity(String custom, String official) {
        String left = normalize(custom);
        String right = normalize(official);
        if (left.isEmpty() || right.isEmpty()) return 0;
        if (left.equals(right)) return 4;
        if (Math.min(left.length(), right.length()) >= 2 && (right.startsWith(left) || left.startsWith(right))) return 3;
        if (left.equals(initials(official)) || right.equals(initials(custom))) return 2;
        if (left.charAt(0) == right.charAt(0) && (isSubsequence(left, right) || isSubsequence(right, left))) return 1;
        return 0;
    }

    private static String normalize(String name) {
        return name == null ? "" : name.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", "");
    }

    private static String initials(String name) {
        if (name == null) return "";
        StringBuilder result = new StringBuilder();
        for (String word : name.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+")) {
            if (!word.isEmpty()) result.append(word.charAt(0));
        }
        return result.toString();
    }

    private static boolean isSubsequence(String small, String big) {
        int index = 0;
        for (int i = 0; i < big.length() && index < small.length(); i++) {
            if (big.charAt(i) == small.charAt(index)) index++;
        }
        return index == small.length();
    }

    private static String name(com.porra.mundial.model.Team team) {
        return team == null ? null : team.getName();
    }

    /**
     * Reconstruye el cuadro pronosticado sobre los cruces oficiales: en cada cruce pasa el equipo que el
     * participante llevaba más lejos. Con los mismos emparejamientos el resultado es idéntico.
     */
    static void translate(PredictionDataDTO data, Map<String, String> names, List<Match> officialFirst) {
        Map<String, Integer> reach = new HashMap<>();
        List<List<String>> rounds = data.getCustomRounds();
        for (int round = 0; round < rounds.size(); round++) {
            if (rounds.get(round) == null) continue;
            for (String pick : rounds.get(round)) {
                String official = names.getOrDefault(pick, pick);
                if (official != null) reach.merge(official, round + 1, Math::max);
            }
        }
        List<String> current = new ArrayList<>();
        for (Match match : officialFirst) {
            current.add(name(match.getHomeTeam()));
            current.add(name(match.getAwayTeam()));
        }
        List<List<String>> translated = new ArrayList<>();
        while (current.size() > 1) {
            List<String> next = new ArrayList<>();
            for (int pair = 0; pair * 2 < current.size(); pair++) {
                String home = current.get(pair * 2);
                String away = pair * 2 + 1 < current.size() ? current.get(pair * 2 + 1) : null;
                boolean awayWins = away != null && reach.getOrDefault(away, 0) > reach.getOrDefault(home, 0);
                next.add(awayWins ? away : home);
            }
            translated.add(next);
            current = next;
        }
        data.setCustomRounds(translated);
        data.setChampion(current.isEmpty() ? null : current.get(0));
        data.setGroups(null);
    }
}
