package app.porrapp.service.demo;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Quita de los datos de la demo todo lo que identifica a alguien: cada participante pasa a llamarse
 * con un nombre de pila inventado (siempre el mismo para el mismo usuario), las ligas llevan su
 * nombre de demo y desaparecen correos, fotos y códigos de invitación. Los ids de usuario se cambian
 * por otros propios de la demo: los reales se ven junto al nombre verdadero en las ligas públicas.
 */
final class DemoAnonymizer {

    static final String JOIN_CODE = "DEMO2026";

    /** Los mismos nombres que la foto fija de la demo, para que no cambien al pasar a datos en vivo. */
    private static final Map<Long, String> KNOWN = Map.ofEntries(
            Map.entry(1L, "Dani"), Map.entry(3L, "Noa"), Map.entry(5L, "Alba"), Map.entry(6L, "Marcos"),
            Map.entry(7L, "Marta"), Map.entry(8L, "Sara"), Map.entry(9L, "Leo"), Map.entry(10L, "Nico"),
            Map.entry(11L, "Pablo"), Map.entry(12L, "Toni"), Map.entry(13L, "Clara"), Map.entry(14L, "Aitana"),
            Map.entry(15L, "Nerea"), Map.entry(17L, "Irene"), Map.entry(18L, "Mateo"), Map.entry(19L, "Carla"),
            Map.entry(20L, "Adri"), Map.entry(21L, "Óscar"), Map.entry(22L, "Julia"), Map.entry(23L, "Álex"),
            Map.entry(24L, "Javi"), Map.entry(25L, "Hugo"), Map.entry(29L, "Vega"));

    /**
     * Id de demo de cada persona de {@link #KNOWN}, el mismo siempre para que la app pueda ponerle su
     * retrato (frontend/src/demo/avatars.ts). Los demás reciben uno a partir de {@link #FIRST_SPARE_ID}.
     */
    private static final List<Long> KNOWN_ORDER = List.of(
            1L, 3L, 5L, 6L, 7L, 8L, 9L, 10L, 11L, 12L, 13L, 14L, 15L, 17L, 18L, 19L, 20L, 21L, 22L, 23L, 24L, 25L, 29L);
    static final long FIRST_KNOWN_ID = 101;
    static final long FIRST_SPARE_ID = 201;
    /** Campos con el id de un usuario, o con una lista de ids. */
    private static final Set<String> USER_ID_FIELDS = Set.of("userId", "adminUserId");
    private static final Set<String> USER_ID_LISTS = Set.of("adminUserIds", "organizerUserIds");

    /** Para quien entre después en alguna de las ligas. */
    private static final List<String> SPARE = List.of(
            "Lucía", "Diego", "Paula", "Bruno", "Elena", "Marc", "Sofía", "Iván", "Lola", "Rubén",
            "Carmen", "Gonzalo", "Inés", "Víctor", "Laura", "Sergio", "Eva", "Raúl", "Ainhoa", "Jorge",
            "Nuria", "Íker", "Rocío", "Martín", "Silvia", "Andrés", "Olga", "Samuel", "Celia", "Tomás");

    /** Campos con el nombre del participante en los objetos que llevan su userId. */
    private static final List<String> NAME_FIELDS = List.of("participantName", "name", "predictionName");
    /** Campos con el nombre de un pronóstico. */
    private static final Set<String> PREDICTION_FIELDS = Set.of("predictionName", "prediction");
    /** Campos que no salen nunca. */
    private static final Set<String> DROPPED = Set.of("email", "emailVerified", "phone", "pushEndpoint");
    /** Imágenes subidas por alguien: la demo pone sus propios retratos. */
    private static final Set<String> NO_IMAGE = Set.of("avatarUrl", "imageUrl");

    private final Map<Long, String> pseudonyms = new LinkedHashMap<>();
    private final Map<Long, Long> demoIds = new LinkedHashMap<>();
    private long nextSpareId = FIRST_SPARE_ID;
    private final Map<String, String> replacements = new LinkedHashMap<>();
    /**
     * Nombres de pronóstico elegidos por cada uno: pueden ser cualquier cosa («Real Madrid»), así que
     * solo se cambian donde aparecen enteros como nombre de un pronóstico, no dentro de otros textos.
     */
    private final Map<String, String> predictionNames = new LinkedHashMap<>();
    private final Map<Long, String> leagueNames;
    private Pattern pattern;

    /** @param leagueNames nombre de demo de cada liga incluida */
    DemoAnonymizer(Map<Long, String> leagueNames) {
        this.leagueNames = leagueNames;
    }

    /** Anonimiza en el sitio todos los nodos, después de ver en ellos quién es quién. */
    void anonymize(List<JsonNode> nodes) {
        Map<Long, Set<String>> realNames = new LinkedHashMap<>();
        Map<Long, Set<String>> realPredictionNames = new LinkedHashMap<>();
        Map<Long, String> realLeagueNames = new LinkedHashMap<>();
        nodes.forEach(node -> collect(node, realNames, realPredictionNames, realLeagueNames));

        Set<String> used = new HashSet<>(KNOWN.values());
        int spare = 0;
        for (Map.Entry<Long, Set<String>> person : realNames.entrySet()) {
            String alias = KNOWN.get(person.getKey());
            if (alias == null) {
                while (spare < SPARE.size() && used.contains(SPARE.get(spare))) spare++;
                alias = spare < SPARE.size() ? SPARE.get(spare++) : "Participante " + demoId(person.getKey());
                used.add(alias);
            }
            pseudonyms.put(person.getKey(), alias);
            for (String real : person.getValue()) {
                if (real.trim().length() >= 2) replacements.putIfAbsent(real.trim(), alias);
            }
        }
        realPredictionNames.forEach((userId, names) -> {
            String alias = pseudonym(userId);
            names.forEach(name -> predictionNames.putIfAbsent(name, replaceLater(name, alias)));
        });
        realLeagueNames.forEach((id, real) -> {
            String alias = leagueNames.get(id);
            if (alias != null && !real.isBlank()) replacements.put(real.trim(), alias);
        });
        List<String> keys = new ArrayList<>(replacements.keySet());
        keys.sort(Comparator.comparingInt(String::length).reversed());
        pattern = keys.isEmpty() ? null : Pattern.compile("(?<![\\p{L}\\p{N}])(?:"
                + String.join("|", keys.stream().map(Pattern::quote).toList()) + ")(?![\\p{L}\\p{N}])");

        predictionNames.replaceAll((real, alias) -> alias == null ? replaceNames(real) : alias);
        nodes.forEach(this::clean);
    }

    /** null: el nombre de pronóstico ya lleva el nombre real y basta con cambiar ese trozo. */
    private String replaceLater(String predictionName, String alias) {
        return replacements.entrySet().stream()
                .anyMatch(e -> e.getValue().equals(alias) && predictionName.contains(e.getKey())) ? null : alias;
    }

    String pseudonym(long userId) {
        String known = pseudonyms.getOrDefault(userId, KNOWN.get(userId));
        return known != null ? known : "Participante " + demoId(userId);
    }

    /** Id con el que sale cada usuario en la demo; no se puede cruzar con el real. */
    long demoId(long userId) {
        return demoIds.computeIfAbsent(userId, id -> {
            int known = KNOWN_ORDER.indexOf(id);
            return known >= 0 ? FIRST_KNOWN_ID + known : nextSpareId++;
        });
    }

    /** Sustituye nombres reales de personas y ligas dentro de un texto libre. */
    String replaceNames(String text) {
        if (pattern == null || text == null || text.isEmpty()) return text;
        Matcher matcher = pattern.matcher(text);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            matcher.appendReplacement(out, Matcher.quoteReplacement(replacements.get(matcher.group())));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    private void collect(JsonNode node, Map<Long, Set<String>> realNames,
                         Map<Long, Set<String>> realPredictionNames, Map<Long, String> realLeagueNames) {
        if (node instanceof ObjectNode object) {
            Long userId = number(object, "userId");
            if (userId != null) {
                for (String field : NAME_FIELDS) {
                    JsonNode value = object.get(field);
                    if (value != null && value.isString()) {
                        (field.equals("predictionName") ? realPredictionNames : realNames)
                                .computeIfAbsent(userId, id -> new HashSet<>()).add(value.asString());
                    }
                }
            }
            Long adminId = number(object, "adminUserId");
            JsonNode adminName = object.get("adminParticipantName");
            if (adminId != null && adminName != null && adminName.isString()) {
                realNames.computeIfAbsent(adminId, id -> new HashSet<>()).add(adminName.asString());
            }
            Long leagueId = isLeague(object) ? number(object, "id") : null;
            JsonNode leagueName = object.get("name");
            if (leagueId != null && leagueName != null && leagueName.isString()) {
                realLeagueNames.putIfAbsent(leagueId, leagueName.asString());
            }
            object.properties().forEach(entry ->
                    collect(entry.getValue(), realNames, realPredictionNames, realLeagueNames));
        } else if (node instanceof ArrayNode array) {
            array.forEach(item -> collect(item, realNames, realPredictionNames, realLeagueNames));
        }
    }

    private void clean(JsonNode node) {
        if (node instanceof ObjectNode object) {
            DROPPED.forEach(object::remove);
            List<String> fields = new ArrayList<>();
            object.properties().forEach(entry -> fields.add(entry.getKey()));
            for (String field : fields) {
                JsonNode value = object.get(field);
                if (NO_IMAGE.contains(field)) {
                    object.putNull(field);
                } else if (field.equals("joinCode") && !value.isNull()) {
                    object.put(field, JOIN_CODE);
                } else if (value.isString() && PREDICTION_FIELDS.contains(field)
                        && predictionNames.containsKey(value.asString())) {
                    object.put(field, predictionNames.get(value.asString()));
                } else if (value.isString()) {
                    object.put(field, replaceNames(value.asString()));
                } else {
                    clean(value);
                }
            }
            Long userId = number(object, "userId");
            if (userId != null) {
                String alias = pseudonym(userId);
                for (String field : NAME_FIELDS) {
                    JsonNode value = object.get(field);
                    // Un nombre de pronóstico inventado por la persona no pasa: queda el del participante.
                    if (value != null && value.isString() && !value.asString().contains(alias)) {
                        object.put(field, alias);
                    }
                }
            }
            Long adminId = number(object, "adminUserId");
            if (adminId != null && object.has("adminParticipantName")) {
                object.put("adminParticipantName", pseudonym(adminId));
            }
            Long leagueId = isLeague(object) ? number(object, "id") : null;
            if (leagueId != null && leagueNames.containsKey(leagueId)) {
                object.put("name", leagueNames.get(leagueId));
                object.put("publicLeague", true);
            }
            // Al final: los nombres de arriba se eligen con el id real.
            for (String field : USER_ID_FIELDS) {
                Long id = number(object, field);
                if (id != null) object.put(field, demoId(id));
            }
            for (String field : USER_ID_LISTS) {
                if (object.get(field) instanceof ArrayNode ids) {
                    for (int i = 0; i < ids.size(); i++) {
                        if (ids.get(i).isIntegralNumber()) ids.set(i, ids.numberNode(demoId(ids.get(i).asLong())));
                    }
                }
            }
        } else if (node instanceof ArrayNode array) {
            for (int i = 0; i < array.size(); i++) {
                JsonNode item = array.get(i);
                if (item.isString()) array.set(i, array.stringNode(replaceNames(item.asString())));
                else clean(item);
            }
        }
    }

    /** Las ligas son los objetos con código de invitación o con su competición. */
    private static boolean isLeague(ObjectNode object) {
        return object.has("id") && object.has("name") && (object.has("joinCode") || object.has("competitionName"));
    }

    private static Long number(ObjectNode object, String field) {
        JsonNode value = object.get(field);
        return value != null && value.isIntegralNumber() ? value.asLong() : null;
    }
}
