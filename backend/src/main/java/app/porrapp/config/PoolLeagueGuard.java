package app.porrapp.config;

import app.porrapp.exception.BusinessException;
import app.porrapp.model.League;
import app.porrapp.repository.LeagueRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Optional;

/**
 * Una liga de juegos de mesa no tiene competición ni predicciones: toda ruta de porra que reciba una
 * se corta aquí con un error claro, en vez de llegar a un servicio que espera una edición y fallar con 500.
 * Es la única comprobación; los servicios de porra no repiten la suya.
 */
@Configuration
public class PoolLeagueGuard implements WebMvcConfigurer, HandlerInterceptor {

    static final String MESSAGE = "Esta liga es de juegos de mesa y no tiene predicciones.";

    /** Rutas de porra que llevan la liga en el parámetro {@code groupId}. */
    static final String[] BY_PARAM = {"/api/predictions", "/api/predictions/matchday/**", "/api/leaderboard",
            "/api/leaderboard/**", "/api/grand-prix", "/api/grand-prix/**"};

    /** Rutas de porra que llevan la liga en la ruta: {@code /api/groups/{id}/...}. */
    static final String[] BY_PATH = {"/api/groups/*/competition/**", "/api/groups/*/scoring",
            "/api/groups/*/repeat", "/api/groups/*/scorer-pick", "/api/groups/*/scorer-picks",
            "/api/groups/*/scorer-picks/**"};

    private final ObjectProvider<LeagueRepository> leagues;

    public PoolLeagueGuard(ObjectProvider<LeagueRepository> leagues) {
        this.leagues = leagues;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this).addPathPatterns(BY_PARAM).addPathPatterns(BY_PATH);
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        LeagueRepository repository = leagues.getIfAvailable();
        if (repository == null) return true;
        leagueId(request).flatMap(repository::findById).filter(League::isScoreboard).ifPresent(league -> {
            throw BusinessException.badRequest(MESSAGE);
        });
        return true;
    }

    static Optional<Long> leagueId(HttpServletRequest request) {
        String uri = request.getRequestURI().substring(request.getContextPath().length());
        String raw = uri.startsWith("/api/groups/") ? uri.split("/")[3] : request.getParameter("groupId");
        if (raw == null) return Optional.empty();
        try {
            return Optional.of(Long.valueOf(raw));
        } catch (NumberFormatException notANumber) {
            return Optional.empty();
        }
    }
}
