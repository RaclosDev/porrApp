package app.porrapp.scoring;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Empareja el nombre de un jugador escrito a mano con el jugador real, para que dos formas de escribir al
 * mismo puntúen igual. Admite tildes y mayúsculas, el nombre completo, el corto ("K. Mbappé"),
 * "Inicial. Apellido", pequeñas erratas y el apellido solo. Lo escrito se identifica con un único jugador
 * de entre todos los conocidos: si encaja con más de uno, con ninguno (así "Sergio Ramos" nunca da por
 * bueno a "Gonçalo Ramos").
 */
public final class ScorerNameMatcher {

    private ScorerNameMatcher() {
    }

    /**
     * Jugador con el que se puede emparejar un nombre.
     *
     * @param id        id en el proveedor; vacío si no se conoce
     * @param name      nombre completo
     * @param shortName nombre corto con el que lo muestra el proveedor ("K. Mbappé")
     */
    public record Player(String id, String name, String shortName) {
    }

    /**
     * A quién se refiere un nombre escrito.
     *
     * @param player     el jugador, si encaja con uno solo; null si es dudoso
     * @param candidates si es dudoso, los jugadores con los que encaja (vacío si con ninguno)
     */
    public record Resolution(Player player, List<Player> candidates) {
        public boolean doubtful() {
            return player == null;
        }
    }

    /**
     * Formas normalizadas con las que se puede escribir a un jugador.
     *
     * @param full     nombre completo
     * @param exact    nombre completo, nombre corto e "inicial apellido"
     * @param surnames lo que va tras el nombre de pila y la última palabra; un nombre de una sola palabra es su apellido
     * @param initial  inicial del nombre de pila
     * @param source   el jugador
     */
    private record PlayerForms(String full, Set<String> exact, Set<String> surnames, String initial, Player source) {
        static PlayerForms of(Player player) {
            String full = normalize(player.name());
            String[] tokens = full.split(" ");
            Set<String> exact = new HashSet<>();
            Set<String> surnames = new HashSet<>();
            exact.add(full);
            String shortName = normalize(player.shortName());
            if (!shortName.isEmpty()) exact.add(shortName);
            if (tokens.length > 1) {
                String afterFirstName = String.join(" ", Arrays.copyOfRange(tokens, 1, tokens.length));
                String lastName = tokens[tokens.length - 1];
                surnames.add(afterFirstName);
                surnames.add(lastName);
                exact.add(tokens[0].charAt(0) + " " + afterFirstName);
                exact.add(tokens[0].charAt(0) + " " + lastName);
            } else {
                surnames.add(full);
            }
            return new PlayerForms(full, exact, surnames, full.isEmpty() ? "" : full.substring(0, 1), player);
        }
    }

    /**
     * Si lo escrito se refiere a este jugador. Se identifica con un único jugador de entre los conocidos y
     * solo cuenta si es este. Dos conocidos con el mismo nombre completo cuentan como uno.
     */
    public static boolean isSamePlayer(String written, Player player, List<Player> known) {
        String user = normalize(written);
        if (user.isEmpty()) return false;
        PlayerForms target = PlayerForms.of(player);
        if (target.full().isEmpty()) return false;

        Map<String, PlayerForms> players = new LinkedHashMap<>();
        players.put(target.full(), target);
        for (Player other : known) {
            PlayerForms forms = PlayerForms.of(other);
            if (!forms.full().isEmpty()) players.putIfAbsent(forms.full(), forms);
        }
        PlayerForms chosen = resolveScorer(user, new ArrayList<>(players.values()));
        return chosen != null && chosen.full().equals(target.full());
    }

    /**
     * A qué jugador de la lista se refiere lo escrito. Dos jugadores distintos con el mismo nombre lo dejan
     * dudoso entre los dos.
     */
    public static Resolution resolve(String written, List<Player> players) {
        String user = normalize(written);
        if (user.isEmpty() || players == null) return new Resolution(null, List.of());
        List<PlayerForms> forms = players.stream().map(PlayerForms::of).filter(p -> !p.full().isEmpty()).toList();
        PlayerForms chosen = resolveScorer(user, forms);
        if (chosen != null) return new Resolution(chosen.source(), List.of());
        return new Resolution(null, similar(user, forms).stream().map(PlayerForms::source).toList());
    }

    /** El jugador al que se refiere el texto, o null si no encaja con ninguno o encaja con más de uno. */
    private static PlayerForms resolveScorer(String user, List<PlayerForms> players) {
        List<PlayerForms> exact = players.stream().filter(p -> p.exact().contains(user)).toList();
        if (!exact.isEmpty()) return onlyOne(exact);

        String[] tokens = user.split(" ");
        if (tokens.length == 2 && tokens[0].length() == 1) {
            // "K. Mbape": la inicial tiene que coincidir; el apellido admite erratas.
            return onlyOne(players.stream()
                    .filter(p -> p.initial().equals(tokens[0]) && p.surnames().stream().anyMatch(s -> isTypoOf(tokens[1], s)))
                    .toList());
        }

        List<PlayerForms> bySurname = players.stream()
                .filter(p -> p.surnames().stream().anyMatch(s -> isTypoOf(user, s)))
                .toList();
        if (!bySurname.isEmpty()) return onlyOne(bySurname);

        // Nombre completo con erratas: el más parecido, si lo es claramente.
        PlayerForms closest = null;
        int bestDistance = Integer.MAX_VALUE;
        boolean tied = false;
        for (PlayerForms p : players) {
            int distance = levenshteinDistance(user, p.full());
            if (distance < bestDistance) {
                closest = p;
                bestDistance = distance;
                tied = false;
            } else if (distance == bestDistance) {
                tied = true;
            }
        }
        return closest != null && !tied && bestDistance <= maxTypos(closest.full()) ? closest : null;
    }

    /**
     * Jugadores con los que encaja un texto que no se ha podido identificar con uno solo. Además de los que
     * lo dejan en duda por repetirse, los que llevan todas sus palabras en el nombre ("Vinicius", "Lamine"):
     * el nombre de pila solo no basta para dar a nadie por bueno, pero sí para proponerlo.
     */
    private static List<PlayerForms> similar(String user, List<PlayerForms> players) {
        List<PlayerForms> exact = players.stream().filter(p -> p.exact().contains(user)).toList();
        if (!exact.isEmpty()) return exact;
        String[] tokens = user.split(" ");
        if (tokens.length == 2 && tokens[0].length() == 1) {
            return players.stream()
                    .filter(p -> p.initial().equals(tokens[0]) && p.surnames().stream().anyMatch(s -> isTypoOf(tokens[1], s)))
                    .toList();
        }
        List<PlayerForms> bySurname = players.stream()
                .filter(p -> p.surnames().stream().anyMatch(s -> isTypoOf(user, s)))
                .toList();
        if (!bySurname.isEmpty()) return bySurname;
        return players.stream().filter(p -> isTypoOf(user, p.full()) || hasEveryWord(tokens, p.full())).toList();
    }

    /** Si cada palabra escrita es, con alguna errata, una de las del nombre. */
    private static boolean hasEveryWord(String[] written, String full) {
        String[] words = full.split(" ");
        return Arrays.stream(written).allMatch(token -> Arrays.stream(words).anyMatch(word -> isTypoOf(token, word)));
    }

    private static PlayerForms onlyOne(List<PlayerForms> candidates) {
        return candidates.size() == 1 ? candidates.get(0) : null;
    }

    /** Si {@code text} es {@code expected} o lo escribe con alguna errata, según su longitud. */
    private static boolean isTypoOf(String text, String expected) {
        return levenshteinDistance(text, expected) <= maxTypos(expected);
    }

    /** Erratas admitidas: ninguna en nombres de menos de 5 letras, una hasta 11 y dos a partir de 12. */
    private static int maxTypos(String expected) {
        int length = expected.length();
        if (length < 5) return 0;
        return length < 12 ? 1 : 2;
    }

    /** Minúsculas, sin tildes ni signos, espacios simples y "Jr" como "Junior". */
    public static String normalize(String input) {
        if (input == null) return "";
        String text = Normalizer.normalize(input, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replace("ø", "o").replace("æ", "ae").replace("œ", "oe").replace("ß", "ss")
                .replace("đ", "d").replace("ł", "l").replace("ı", "i")
                .replaceAll("['’`´]", "")
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
        if (text.isEmpty()) return "";
        return Arrays.stream(text.split(" "))
                .map(token -> token.equals("jr") ? "junior" : token)
                .collect(Collectors.joining(" "));
    }

    private static int levenshteinDistance(String a, String b) {
        int[] costs = new int[b.length() + 1];
        for (int j = 0; j < costs.length; j++) costs[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            costs[0] = i;
            int nw = i - 1;
            for (int j = 1; j <= b.length(); j++) {
                int cj = Math.min(1 + Math.min(costs[j], costs[j - 1]), a.charAt(i - 1) == b.charAt(j - 1) ? nw : nw + 1);
                nw = costs[j];
                costs[j] = cj;
            }
        }
        return costs[b.length()];
    }
}
