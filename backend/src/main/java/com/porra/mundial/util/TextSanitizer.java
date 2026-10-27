package com.porra.mundial.util;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Utilidad centralizada para saneamiento de texto, corrección de mojibake (UTF-8 doble codificado)
 * y caracteres corruptos ('??' o Unicode replacement) en nombres de países, equipos y participantes.
 */
public final class TextSanitizer {

    private static final Map<String, String> MOJIBAKE_MAP = new LinkedHashMap<>();
    private static final Map<String, String> TEAM_CORRECTIONS = new LinkedHashMap<>();
    private static final Map<String, String> PARTICIPANT_CORRECTIONS = new LinkedHashMap<>();
    private static final Map<String, String> COUNTRY_CODE_MAP = new LinkedHashMap<>();


    static {
        // Mapeo Mojibake UTF-8 decodificado como Windows-1252/ISO-8859-1
        MOJIBAKE_MAP.put("Ã¡", "á");
        MOJIBAKE_MAP.put("Ã©", "é");
        MOJIBAKE_MAP.put("Ã\u00AD", "í");
        MOJIBAKE_MAP.put("Ã­", "í");
        MOJIBAKE_MAP.put("Ã³", "ó");
        MOJIBAKE_MAP.put("Ãº", "ú");
        MOJIBAKE_MAP.put("Ã±", "ñ");
        MOJIBAKE_MAP.put("Ã\u0081", "Á");
        MOJIBAKE_MAP.put("Ã ", "Á");
        MOJIBAKE_MAP.put("Ã\u0089", "É");
        MOJIBAKE_MAP.put("Ã‰", "É");
        MOJIBAKE_MAP.put("Ã\u008D", "Í");
        MOJIBAKE_MAP.put("Ã ", "Í");
        MOJIBAKE_MAP.put("Ã\u0093", "Ó");
        MOJIBAKE_MAP.put("Ã“", "Ó");
        MOJIBAKE_MAP.put("Ã\u009A", "Ú");
        MOJIBAKE_MAP.put("Ãš", "Ú");
        MOJIBAKE_MAP.put("Ã\u0091", "Ñ");
        MOJIBAKE_MAP.put("Ã‘", "Ñ");
        MOJIBAKE_MAP.put("Ã§", "ç");
        MOJIBAKE_MAP.put("Ã¼", "ü");

        // Equipos corruptos con ?? o caracteres sustituidos
        TEAM_CORRECTIONS.put("Espa??a", "España");
        TEAM_CORRECTIONS.put("Espa?a", "España");
        TEAM_CORRECTIONS.put("Espa\uFFFDa", "España");
        TEAM_CORRECTIONS.put("Espaa", "España");
        TEAM_CORRECTIONS.put("M??xico", "México");
        TEAM_CORRECTIONS.put("M?xico", "México");
        TEAM_CORRECTIONS.put("M\uFFFDxico", "México");
        TEAM_CORRECTIONS.put("Sud??frica", "Sudáfrica");
        TEAM_CORRECTIONS.put("Sud?frica", "Sudáfrica");
        TEAM_CORRECTIONS.put("Sud\uFFFDfrica", "Sudáfrica");
        TEAM_CORRECTIONS.put("Canad??", "Canadá");
        TEAM_CORRECTIONS.put("Canad\uFFFD", "Canadá");
        TEAM_CORRECTIONS.put("Hait??", "Haití");
        TEAM_CORRECTIONS.put("Hait\uFFFD", "Haití");
        TEAM_CORRECTIONS.put("Turqu??a", "Turquía");
        TEAM_CORRECTIONS.put("Turqu\uFFFDa", "Turquía");
        TEAM_CORRECTIONS.put("Cura??ao", "Curaçao");
        TEAM_CORRECTIONS.put("Cura\uFFFDao", "Curaçao");
        TEAM_CORRECTIONS.put("Pa??ses Bajos", "Países Bajos");
        TEAM_CORRECTIONS.put("Pa\uFFFDses Bajos", "Países Bajos");
        TEAM_CORRECTIONS.put("Jap??n", "Japón");
        TEAM_CORRECTIONS.put("Jap\uFFFDn", "Japón");
        TEAM_CORRECTIONS.put("T??nez", "Túnez");
        TEAM_CORRECTIONS.put("T\uFFFDnez", "Túnez");
        TEAM_CORRECTIONS.put("B??lgica", "Bélgica");
        TEAM_CORRECTIONS.put("B\uFFFDlgica", "Bélgica");
        TEAM_CORRECTIONS.put("Ir??n", "Irán");
        TEAM_CORRECTIONS.put("Ir\uFFFDn", "Irán");
        TEAM_CORRECTIONS.put("Arabia Saud??", "Arabia Saudí");
        TEAM_CORRECTIONS.put("Saud??", "Saudí");
        TEAM_CORRECTIONS.put("Panam??", "Panamá");
        TEAM_CORRECTIONS.put("Panam\uFFFD", "Panamá");
        TEAM_CORRECTIONS.put("Uzbekist??n", "Uzbekistán");
        TEAM_CORRECTIONS.put("Uzbekist\uFFFDn", "Uzbekistán");
        TEAM_CORRECTIONS.put("Camer??n", "Camerún");
        TEAM_CORRECTIONS.put("Atl??tico de Madrid", "Atlético de Madrid");
        TEAM_CORRECTIONS.put("Alav??s", "Alavés");
        TEAM_CORRECTIONS.put("Legan??s", "Leganés");
        TEAM_CORRECTIONS.put("C??diz", "Cádiz");
        TEAM_CORRECTIONS.put("Almer??a", "Almería");
        TEAM_CORRECTIONS.put("M??laga", "Málaga");
        TEAM_CORRECTIONS.put("La Coru??a", "La Coruña");

        // Participantes comunes con ??
        PARTICIPANT_CORRECTIONS.put("An??nimo", "Anónimo");
        PARTICIPANT_CORRECTIONS.put("An?nimo", "Anónimo");
        PARTICIPANT_CORRECTIONS.put("Ra??l", "Raúl");
        PARTICIPANT_CORRECTIONS.put("Jos??", "José");
        PARTICIPANT_CORRECTIONS.put("Adri??n", "Adrián");
        PARTICIPANT_CORRECTIONS.put("??ngel", "Ángel");
        PARTICIPANT_CORRECTIONS.put("??lvaro", "Álvaro");
        PARTICIPANT_CORRECTIONS.put("??scar", "Óscar");
        PARTICIPANT_CORRECTIONS.put("I??aki", "Iñaki");
        PARTICIPANT_CORRECTIONS.put("Rub??n", "Rubén");
        PARTICIPANT_CORRECTIONS.put("V??ctor", "Víctor");
        PARTICIPANT_CORRECTIONS.put("Jes??s", "Jesús");
        PARTICIPANT_CORRECTIONS.put("H??ctor", "Héctor");
        PARTICIPANT_CORRECTIONS.put("C??sar", "César");
        PARTICIPANT_CORRECTIONS.put("F??lix", "Félix");
        PARTICIPANT_CORRECTIONS.put("Andr??s", "Andrés");
        PARTICIPANT_CORRECTIONS.put("Tom??s", "Tomás");
        PARTICIPANT_CORRECTIONS.put("Mat??as", "Matías");
        PARTICIPANT_CORRECTIONS.put("Nicol??s", "Nicolás");
        PARTICIPANT_CORRECTIONS.put("Agust??n", "Agustín");
        PARTICIPANT_CORRECTIONS.put("Mart??n", "Martín");
        PARTICIPANT_CORRECTIONS.put("Joaqu??n", "Joaquín");
        PARTICIPANT_CORRECTIONS.put("Iv??n", "Iván");
        PARTICIPANT_CORRECTIONS.put("Sebasti??n", "Sebastián");
        PARTICIPANT_CORRECTIONS.put("Gonz??lez", "González");

        COUNTRY_CODE_MAP.put("méxico", "mx");
        COUNTRY_CODE_MAP.put("mexico", "mx");
        COUNTRY_CODE_MAP.put("sudáfrica", "za");
        COUNTRY_CODE_MAP.put("sudafrica", "za");
        COUNTRY_CODE_MAP.put("corea del sur", "kr");
        COUNTRY_CODE_MAP.put("corea", "kr");
        COUNTRY_CODE_MAP.put("chequia", "cz");
        COUNTRY_CODE_MAP.put("canadá", "ca");
        COUNTRY_CODE_MAP.put("canada", "ca");
        COUNTRY_CODE_MAP.put("bosnia y her.", "ba");
        COUNTRY_CODE_MAP.put("bosnia y herzegovina", "ba");
        COUNTRY_CODE_MAP.put("bosnia", "ba");
        COUNTRY_CODE_MAP.put("catar", "qa");
        COUNTRY_CODE_MAP.put("qatar", "qa");
        COUNTRY_CODE_MAP.put("suiza", "ch");
        COUNTRY_CODE_MAP.put("brasil", "br");
        COUNTRY_CODE_MAP.put("brazil", "br");
        COUNTRY_CODE_MAP.put("marruecos", "ma");
        COUNTRY_CODE_MAP.put("haití", "ht");
        COUNTRY_CODE_MAP.put("haiti", "ht");
        COUNTRY_CODE_MAP.put("escocia", "gb-sct");
        COUNTRY_CODE_MAP.put("eeuu", "us");
        COUNTRY_CODE_MAP.put("ee.uu.", "us");
        COUNTRY_CODE_MAP.put("estados unidos", "us");
        COUNTRY_CODE_MAP.put("usa", "us");
        COUNTRY_CODE_MAP.put("turquía", "tr");
        COUNTRY_CODE_MAP.put("turquia", "tr");
        COUNTRY_CODE_MAP.put("paraguay", "py");
        COUNTRY_CODE_MAP.put("nueva caledonia", "nc");
        COUNTRY_CODE_MAP.put("alemania", "de");
        COUNTRY_CODE_MAP.put("germany", "de");
        COUNTRY_CODE_MAP.put("ecuador", "ec");
        COUNTRY_CODE_MAP.put("costa de marfil", "ci");
        COUNTRY_CODE_MAP.put("curaçao", "cw");
        COUNTRY_CODE_MAP.put("curazao", "cw");
        COUNTRY_CODE_MAP.put("países bajos", "nl");
        COUNTRY_CODE_MAP.put("paises bajos", "nl");
        COUNTRY_CODE_MAP.put("holanda", "nl");
        COUNTRY_CODE_MAP.put("japón", "jp");
        COUNTRY_CODE_MAP.put("japon", "jp");
        COUNTRY_CODE_MAP.put("japan", "jp");
        COUNTRY_CODE_MAP.put("suecia", "se");
        COUNTRY_CODE_MAP.put("sweden", "se");
        COUNTRY_CODE_MAP.put("túnez", "tn");
        COUNTRY_CODE_MAP.put("tunez", "tn");
        COUNTRY_CODE_MAP.put("bélgica", "be");
        COUNTRY_CODE_MAP.put("belgica", "be");
        COUNTRY_CODE_MAP.put("egipto", "eg");
        COUNTRY_CODE_MAP.put("irán", "ir");
        COUNTRY_CODE_MAP.put("iran", "ir");
        COUNTRY_CODE_MAP.put("nueva zelanda", "nz");
        COUNTRY_CODE_MAP.put("españa", "es");
        COUNTRY_CODE_MAP.put("spain", "es");
        COUNTRY_CODE_MAP.put("cabo verde", "cv");
        COUNTRY_CODE_MAP.put("arabia saudí", "sa");
        COUNTRY_CODE_MAP.put("arabia saudi", "sa");
        COUNTRY_CODE_MAP.put("uruguay", "uy");
        COUNTRY_CODE_MAP.put("francia", "fr");
        COUNTRY_CODE_MAP.put("france", "fr");
        COUNTRY_CODE_MAP.put("senegal", "sn");
        COUNTRY_CODE_MAP.put("irak", "iq");
        COUNTRY_CODE_MAP.put("iraq", "iq");
        COUNTRY_CODE_MAP.put("noruega", "no");
        COUNTRY_CODE_MAP.put("norway", "no");
        COUNTRY_CODE_MAP.put("argentina", "ar");
        COUNTRY_CODE_MAP.put("argelia", "dz");
        COUNTRY_CODE_MAP.put("algeria", "dz");
        COUNTRY_CODE_MAP.put("austria", "at");
        COUNTRY_CODE_MAP.put("jordania", "jo");
        COUNTRY_CODE_MAP.put("portugal", "pt");
        COUNTRY_CODE_MAP.put("rd congo", "cd");
        COUNTRY_CODE_MAP.put("r.d. congo", "cd");
        COUNTRY_CODE_MAP.put("república democrática del congo", "cd");
        COUNTRY_CODE_MAP.put("uzbekistán", "uz");
        COUNTRY_CODE_MAP.put("uzbekistan", "uz");
        COUNTRY_CODE_MAP.put("colombia", "co");
        COUNTRY_CODE_MAP.put("inglaterra", "gb-eng");
        COUNTRY_CODE_MAP.put("england", "gb-eng");
        COUNTRY_CODE_MAP.put("croacia", "hr");
        COUNTRY_CODE_MAP.put("croatia", "hr");
        COUNTRY_CODE_MAP.put("ghana", "gh");
        COUNTRY_CODE_MAP.put("panamá", "pa");
        COUNTRY_CODE_MAP.put("panama", "pa");
        COUNTRY_CODE_MAP.put("australia", "au");
        COUNTRY_CODE_MAP.put("dinamarca", "dk");
        COUNTRY_CODE_MAP.put("denmark", "dk");
        COUNTRY_CODE_MAP.put("polonia", "pl");
        COUNTRY_CODE_MAP.put("poland", "pl");
        COUNTRY_CODE_MAP.put("camerún", "cm");
        COUNTRY_CODE_MAP.put("camerun", "cm");
        COUNTRY_CODE_MAP.put("serbia", "rs");

        PARTICIPANT_CORRECTIONS.put("Rodr??guez", "Rodríguez");
        PARTICIPANT_CORRECTIONS.put("Fern??ndez", "Fernández");
        PARTICIPANT_CORRECTIONS.put("L??pez", "López");
        PARTICIPANT_CORRECTIONS.put("Mart??nez", "Martínez");
        PARTICIPANT_CORRECTIONS.put("S??nchez", "Sánchez");
        PARTICIPANT_CORRECTIONS.put("P??rez", "Pérez");
        PARTICIPANT_CORRECTIONS.put("G??mez", "Gómez");
        PARTICIPANT_CORRECTIONS.put("D??az", "Díaz");
        PARTICIPANT_CORRECTIONS.put("??lvarez", "Álvarez");
        PARTICIPANT_CORRECTIONS.put("Mu??oz", "Muñoz");
        PARTICIPANT_CORRECTIONS.put("N??ñez", "Núñez");
        PARTICIPANT_CORRECTIONS.put("N??ez", "Núñez");
        PARTICIPANT_CORRECTIONS.put("Pe??a", "Peña");
    }

    private TextSanitizer() {
    }

    /**
     * Corrige secuencias mojibake de doble codificación UTF-8 / Latin-1.
     */
    public static String fixMojibake(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }
        String result = text;
        for (Map.Entry<String, String> entry : MOJIBAKE_MAP.entrySet()) {
            if (result.contains(entry.getKey())) {
                result = result.replace(entry.getKey(), entry.getValue());
            }
        }
        return result;
    }

    /**
     * Corrige nombres de países y equipos corruptos.
     */
    public static String fixTeamName(String name) {
        if (name == null || name.isBlank()) {
            return name;
        }
        String cleaned = fixMojibake(name.trim());
        for (Map.Entry<String, String> entry : TEAM_CORRECTIONS.entrySet()) {
            if (cleaned.equalsIgnoreCase(entry.getKey()) || cleaned.contains(entry.getKey())) {
                cleaned = cleaned.replace(entry.getKey(), entry.getValue());
            }
        }
        // Casos con comodines específicos
        if (cleaned.startsWith("Espa") && (cleaned.endsWith("a") || cleaned.contains("??")) && !cleaned.equals("España")) {
            return "España";
        }
        if (cleaned.startsWith("M") && cleaned.endsWith("xico") && !cleaned.equals("México")) {
            return "México";
        }
        if (cleaned.startsWith("Sud") && cleaned.endsWith("frica") && !cleaned.equals("Sudáfrica")) {
            return "Sudáfrica";
        }
        return cleaned;
    }

    /**
     * Corrige nombres de participantes corruptos.
     */
    public static String fixParticipantName(String name) {
        if (name == null || name.isBlank()) {
            return name;
        }
        String cleaned = fixMojibake(name.trim());
        for (Map.Entry<String, String> entry : PARTICIPANT_CORRECTIONS.entrySet()) {
            if (cleaned.equalsIgnoreCase(entry.getKey()) || cleaned.contains(entry.getKey())) {
                cleaned = cleaned.replace(entry.getKey(), entry.getValue());
            }
        }
        return cleaned;
    }

    /**
     * Sanea por completo el JSON bracket_data de una predicción.
     */
    public static String fixBracketDataJson(String json) {
        if (json == null || json.isBlank()) {
            return json;
        }
        String sanitized = fixMojibake(json);
        for (Map.Entry<String, String> entry : TEAM_CORRECTIONS.entrySet()) {
            if (sanitized.contains(entry.getKey())) {
                sanitized = sanitized.replace(entry.getKey(), entry.getValue());
            }
        }
        for (Map.Entry<String, String> entry : PARTICIPANT_CORRECTIONS.entrySet()) {
            if (sanitized.contains(entry.getKey())) {
                sanitized = sanitized.replace(entry.getKey(), entry.getValue());
            }
        }
        return sanitized;
    }

    /**
     * Devuelve la ruta relativa local del SVG de la bandera de un país/selección, o null si no aplica.
     */
    public static String getTeamFlagUrl(String teamName) {
        if (teamName == null || teamName.isBlank()) {
            return null;
        }
        String clean = fixTeamName(teamName).trim().toLowerCase();
        String code = COUNTRY_CODE_MAP.get(clean);
        return code != null ? "/flags/" + code + ".svg" : null;
    }

}
