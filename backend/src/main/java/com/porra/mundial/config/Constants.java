package com.porra.mundial.config;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Clase de utilidades y constantes globales de la aplicación.
 * <p>
 * Principalmente contiene el diccionario de traducción estático para convertir 
 * los nombres de los países devueltos por la API de ESPN (en inglés o con alias raros) 
 * a su nomenclatura oficial en español que utiliza nuestro Frontend.
 * </p>
 */
public class Constants {

    /**
     * Diccionario inmutable en memoria que mapea el nombre del equipo de la API (Key)
     * a su versión localizada en español (Value).
     * Se usa un LinkedHashMap para mantener el orden de inserción por claridad,
     * aunque a nivel de búsqueda (get) el orden no importe.
     */
    private static final Map<String, String> API_TO_LOCAL = new LinkedHashMap<>();
    static {
        API_TO_LOCAL.put("Mexico", "México");
        API_TO_LOCAL.put("South Africa", "Sudáfrica");
        API_TO_LOCAL.put("South Korea", "Corea del Sur");
        API_TO_LOCAL.put("Czech Republic", "Chequia");
        API_TO_LOCAL.put("Canada", "Canadá");
        API_TO_LOCAL.put("Bosnia and Herzegovina", "Bosnia y Her.");
        API_TO_LOCAL.put("Qatar", "Catar");
        API_TO_LOCAL.put("Switzerland", "Suiza");
        API_TO_LOCAL.put("Brazil", "Brasil");
        API_TO_LOCAL.put("Morocco", "Marruecos");
        API_TO_LOCAL.put("Haiti", "Haití");
        API_TO_LOCAL.put("Scotland", "Escocia");
        API_TO_LOCAL.put("United States", "EEUU");
        API_TO_LOCAL.put("Paraguay", "Paraguay");
        API_TO_LOCAL.put("Australia", "Australia");
        API_TO_LOCAL.put("Turkey", "Turquía");
        API_TO_LOCAL.put("Germany", "Alemania");
        API_TO_LOCAL.put("Curacao", "Curaçao");
        API_TO_LOCAL.put("Ivory Coast", "Costa de Marfil");
        API_TO_LOCAL.put("Ecuador", "Ecuador");
        API_TO_LOCAL.put("Netherlands", "Países Bajos");
        API_TO_LOCAL.put("Japan", "Japón");
        API_TO_LOCAL.put("Sweden", "Suecia");
        API_TO_LOCAL.put("Tunisia", "Túnez");
        API_TO_LOCAL.put("Belgium", "Bélgica");
        API_TO_LOCAL.put("Egypt", "Egipto");
        API_TO_LOCAL.put("Iran", "Irán");
        API_TO_LOCAL.put("New Zealand", "Nueva Zelanda");
        API_TO_LOCAL.put("Spain", "España");
        API_TO_LOCAL.put("Cape Verde", "Cabo Verde");
        API_TO_LOCAL.put("Saudi Arabia", "Arabia Saudí");
        API_TO_LOCAL.put("Uruguay", "Uruguay");
        API_TO_LOCAL.put("France", "Francia");
        API_TO_LOCAL.put("Senegal", "Senegal");
        API_TO_LOCAL.put("Iraq", "Irak");
        API_TO_LOCAL.put("Norway", "Noruega");
        API_TO_LOCAL.put("Argentina", "Argentina");
        API_TO_LOCAL.put("Algeria", "Argelia");
        API_TO_LOCAL.put("Austria", "Austria");
        API_TO_LOCAL.put("Jordan", "Jordania");
        API_TO_LOCAL.put("Portugal", "Portugal");
        API_TO_LOCAL.put("DR Congo", "RD Congo");
        API_TO_LOCAL.put("Democratic Republic of the Congo", "RD Congo");
        API_TO_LOCAL.put("Uzbekistan", "Uzbekistán");
        API_TO_LOCAL.put("Colombia", "Colombia");
        API_TO_LOCAL.put("England", "Inglaterra");
        API_TO_LOCAL.put("Croatia", "Croacia");
        API_TO_LOCAL.put("Ghana", "Ghana");
        API_TO_LOCAL.put("Panama", "Panamá");
        
        // Alias extra de la API de ESPN (cuando ESPN devuelve acrónimos o nombres distintos)
        API_TO_LOCAL.put("USA", "EEUU");
        API_TO_LOCAL.put("United States", "EEUU");
        API_TO_LOCAL.put("Turkiye", "Turquía");
        API_TO_LOCAL.put("Türkiye", "Turquía");
        API_TO_LOCAL.put("Czechia", "Chequia");
        API_TO_LOCAL.put("Bosnia-Herzegovina", "Bosnia y Her.");
        API_TO_LOCAL.put("Congo DR", "RD Congo");
    }

    /**
     * Convierte un nombre de equipo proveniente de la API externa (ESPN) a su 
     * nombre correspondiente en Español (local).
     * 
     * @param apiName Nombre original proporcionado por la API (ej. "United States")
     * @return El nombre traducido (ej. "EEUU"). Si no está en el mapa, devuelve el original.
     */
    public static String getLocalName(String apiName) {
        return API_TO_LOCAL.getOrDefault(apiName, apiName);
    }
}
