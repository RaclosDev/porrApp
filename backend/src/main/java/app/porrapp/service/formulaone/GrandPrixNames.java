package app.porrapp.service.formulaone;

import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Nombre en español de un Gran Premio a partir del de ESPN, que lleva patrocinador y va en inglés
 * ("MSC Cruises São Paulo Grand Prix" → "GP de São Paulo").
 */
final class GrandPrixNames {

    private GrandPrixNames() {}

    /** En orden: los más concretos primero ("Bahrain Grand Prix in Malaysia" antes que "Bahrain"). */
    private static final Map<String, String> PLACES = new LinkedHashMap<>();

    static {
        PLACES.put("in malaysia", "Baréin (en Malasia)");
        PLACES.put("barcelona", "Barcelona-Cataluña");
        PLACES.put("emilia", "Emilia-Romaña");
        PLACES.put("mexico city", "la Ciudad de México");
        PLACES.put("mexican", "México");
        PLACES.put("las vegas", "Las Vegas");
        PLACES.put("united states", "Estados Unidos");
        PLACES.put("sao paulo", "São Paulo");
        PLACES.put("brazilian", "Brasil");
        PLACES.put("abu dhabi", "Abu Dabi");
        PLACES.put("saudi", "Arabia Saudí");
        PLACES.put("australian", "Australia");
        PLACES.put("chinese", "China");
        PLACES.put("japanese", "Japón");
        PLACES.put("bahrain", "Baréin");
        PLACES.put("miami", "Miami");
        PLACES.put("canadian", "Canadá");
        PLACES.put("monaco", "Mónaco");
        PLACES.put("spanish", "España");
        PLACES.put("madrid", "Madrid");
        PLACES.put("austrian", "Austria");
        PLACES.put("british", "Gran Bretaña");
        PLACES.put("belgian", "Bélgica");
        PLACES.put("hungarian", "Hungría");
        PLACES.put("dutch", "Países Bajos");
        PLACES.put("italian", "Italia");
        PLACES.put("azerbaijan", "Azerbaiyán");
        PLACES.put("singapore", "Singapur");
        PLACES.put("qatar grand prix", "Catar");
        PLACES.put("portuguese", "Portugal");
        PLACES.put("french", "Francia");
        PLACES.put("german", "Alemania");
        PLACES.put("turkish", "Turquía");
        PLACES.put("russian", "Rusia");
        PLACES.put("south african", "Sudáfrica");
        PLACES.put("argentine", "Argentina");
        PLACES.put("korean", "Corea");
        PLACES.put("indian", "India");
        PLACES.put("vietnam", "Vietnam");
        PLACES.put("thai", "Tailandia");
        PLACES.put("rwand", "Ruanda");
    }

    /** "GP de …"; si no se reconoce, el nombre de ESPN sin "Grand Prix". Nunca más de 50 caracteres. */
    static String spanish(String espnName) {
        if (espnName == null || espnName.isBlank()) return "Gran Premio";
        String plain = Normalizer.normalize(espnName, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
        for (Map.Entry<String, String> place : PLACES.entrySet()) {
            if (plain.contains(place.getKey())) return limit("GP de " + place.getValue());
        }
        String trimmed = espnName.replaceAll("(?i)\\s*grand prix.*$", "").trim();
        return limit(trimmed.isEmpty() ? espnName.trim() : "GP de " + trimmed);
    }

    private static String limit(String name) {
        return name.length() > 50 ? name.substring(0, 50).trim() : name;
    }
}
