package app.porrapp.sports;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/** Elige el proveedor de datos de cada competición. */
@Component
@RequiredArgsConstructor
public class SportsDataProviderRegistry {

    private final List<SportsDataProvider> providers;

    /** El proveedor de la competición; si ninguno la reconoce, ninguno (no se elige uno por defecto). */
    public Optional<SportsDataProvider> findProviderForCompetition(String competitionCode) {
        if (providers == null) return Optional.empty();
        return providers.stream().filter(p -> p.supports(competitionCode)).findFirst();
    }
}
