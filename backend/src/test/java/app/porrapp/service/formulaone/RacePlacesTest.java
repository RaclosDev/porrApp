package app.porrapp.service.formulaone;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RacePlacesTest {

    @Test
    void traduceElPaisYLaCiudadDeEspn() {
        assertThat(RacePlaces.country("Brazil")).isEqualTo("Brasil");
        assertThat(RacePlaces.country("United Arab Emirates")).isEqualTo("Emiratos Árabes Unidos");
        assertThat(RacePlaces.city("Sao Paulo")).isEqualTo("São Paulo");
    }

    @Test
    void enEstadosUnidosCambiaElEstadoPorLaCiudad() {
        assertThat(RacePlaces.city("Nevada")).isEqualTo("Las Vegas");
        assertThat(RacePlaces.city("Florida")).isEqualTo("Miami");
        assertThat(RacePlaces.country("USA")).isEqualTo("EE. UU.");
    }

    @Test
    void loDesconocidoSeQuedaComoViene() {
        assertThat(RacePlaces.country("Atlantis")).isEqualTo("Atlantis");
        assertThat(RacePlaces.city(null)).isNull();
    }
}
