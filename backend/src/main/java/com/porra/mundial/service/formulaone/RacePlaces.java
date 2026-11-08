package com.porra.mundial.service.formulaone;

import java.util.Map;

/**
 * Ciudad y país de los circuitos en español. ESPN los da en inglés y, en Estados Unidos, con el estado
 * en lugar de la ciudad («Florida» para Miami, «Nevada» para Las Vegas). Lo que no está en la tabla se
 * deja como viene.
 */
public final class RacePlaces {

    private RacePlaces() {}

    private static final Map<String, String> COUNTRIES = Map.ofEntries(
            Map.entry("Australia", "Australia"),
            Map.entry("Austria", "Austria"),
            Map.entry("Azerbaijan", "Azerbaiyán"),
            Map.entry("Bahrain", "Baréin"),
            Map.entry("Belgium", "Bélgica"),
            Map.entry("Brazil", "Brasil"),
            Map.entry("Britain", "Reino Unido"),
            Map.entry("Great Britain", "Reino Unido"),
            Map.entry("United Kingdom", "Reino Unido"),
            Map.entry("Canada", "Canadá"),
            Map.entry("China", "China"),
            Map.entry("France", "Francia"),
            Map.entry("Germany", "Alemania"),
            Map.entry("Hungary", "Hungría"),
            Map.entry("Italy", "Italia"),
            Map.entry("Japan", "Japón"),
            Map.entry("Malaysia", "Malasia"),
            Map.entry("Mexico", "México"),
            Map.entry("Monaco", "Mónaco"),
            Map.entry("Netherlands", "Países Bajos"),
            Map.entry("Portugal", "Portugal"),
            Map.entry("Qatar", "Catar"),
            Map.entry("Saudi Arabia", "Arabia Saudí"),
            Map.entry("Singapore", "Singapur"),
            Map.entry("Spain", "España"),
            Map.entry("Turkey", "Turquía"),
            Map.entry("USA", "EE. UU."),
            Map.entry("United States", "EE. UU."),
            Map.entry("United Arab Emirates", "Emiratos Árabes Unidos"),
            Map.entry("Argentina", "Argentina"),
            Map.entry("Finland", "Finlandia"),
            Map.entry("New Zealand", "Nueva Zelanda"),
            Map.entry("Thailand", "Tailandia"),
            Map.entry("Denmark", "Dinamarca"),
            Map.entry("Switzerland", "Suiza"),
            Map.entry("Poland", "Polonia"),
            Map.entry("Russia", "Rusia"),
            Map.entry("South Africa", "Sudáfrica"),
            Map.entry("Rwanda", "Ruanda"),
            Map.entry("Korea", "Corea del Sur"),
            Map.entry("India", "India"),
            Map.entry("Vietnam", "Vietnam"));

    /** Por circuito, ya que la ciudad de ESPN a veces es el estado. */
    private static final Map<String, String> CITIES = Map.ofEntries(
            Map.entry("Sao Paulo", "São Paulo"),
            Map.entry("Mexico City", "Ciudad de México"),
            Map.entry("Florida", "Miami"),
            Map.entry("Nevada", "Las Vegas"),
            Map.entry("Monte Carlo", "Montecarlo"),
            Map.entry("Singapore", "Singapur"),
            Map.entry("Abu Dhabi", "Abu Dabi"),
            Map.entry("Shanghai", "Shanghái"),
            Map.entry("Montreal", "Montreal"),
            Map.entry("Baku", "Bakú"),
            Map.entry("Lusail", "Lusail"),
            Map.entry("Jeddah", "Yeda"),
            Map.entry("Stavelot", "Spa-Francorchamps"));

    public static String country(String espnCountry) {
        return espnCountry == null ? null : COUNTRIES.getOrDefault(espnCountry.trim(), espnCountry);
    }

    public static String city(String espnCity) {
        return espnCity == null ? null : CITIES.getOrDefault(espnCity.trim(), espnCity);
    }
}
