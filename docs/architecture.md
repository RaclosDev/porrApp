# Documentación Arquitectónica del Backend: Porra Mundial 2026

Este documento detalla exhaustivamente la estructura, arquitectura y flujos de datos del Backend de la aplicación "Porra Mundial 2026", diseñada para un entorno de producción de alto rendimiento.

---

## 1. Stack Tecnológico y Arquitectura Base

El backend está construido sobre **Java 21** y **Spring Boot 3.3.0**, siguiendo un patrón arquitectónico clásico de capas (MVC/REST), pero orientado al tipado fuerte y la inmutabilidad.

*   **Framework Principal**: Spring Boot (Web, Data JPA, Security, WebSocket).
*   **Base de Datos**: PostgreSQL para producción; H2 en memoria para desarrollo y pruebas. Control de versiones de esquema gestionado mediante **Flyway**.
*   **Autenticación**: Basada en JWT (JSON Web Tokens) stateless con Spring Security, permitiendo escalabilidad horizontal sin necesidad de compartir sesiones.
*   **Tiempo Real**: Spring WebSockets configurados para propagar actualizaciones en vivo a los clientes cuando los partidos cambian de estado.

La arquitectura se divide en los siguientes paquetes bajo `com.porra.mundial`:
1.  `config/`: Configuración global (Seguridad, CORS, JWT, WebSockets).
2.  `controller/`: Capa de presentación REST (Endpoints).
3.  `dto/`: Objetos de Transferencia de Datos.
4.  `model/`: Entidades JPA mapeadas a las tablas de la base de datos.
5.  `repository/`: Interfaces de acceso a datos (Spring Data JPA).
6.  `service/`: Lógica de negocio core y algoritmos.

---

## 2. Modelos de Datos (Entidades JPA) - `/model`

La base de datos relacional almacena el estado completo del torneo y las predicciones de los usuarios. Las clases más críticas son:

*   **`Team`**: Entidad que representa a un país o un "placeholder" (ej. "1º Grupo A").
*   **`Match`**: Entidad central del torneo. Almacena equipos, fecha, ronda, resultados, estado (`SCHEDULED`, `IN_PLAY`, `FINISHED`) y URLs de escudos.
*   **`UserAccount`**: Representa a un jugador de la porra.
*   **`Prediction`**: Almacena los pronosticos (relaciones normalizadas y backups) enviados por un jugador para una porra/edicion.
*   **`GroupStanding`**: Guarda el estado actual (puntos, goles) de un equipo en la fase de grupos real del torneo.

```java
// Ejemplo de la entidad Match
@Entity
@Table(name = "matches")
@Data
@Builder
public class Match {
    @Id
    private Long id; // ID real proveído por APIs externas (ej. football-data.org)

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "home_team_id")
    private Team homeTeam;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "away_team_id")
    private Team awayTeam;

    private Integer homeScore;
    private Integer awayScore;
    private String status; // SCHEDULED, IN_PLAY, PAUSED, FINISHED
    // ...
}
```

---

## 3. Objetos de Transferencia (DTOs) - `/dto`

Para aislar el modelo de base de datos de los datos expuestos por la API y evitar *Code Smells* como la "Obsesión por Primitivos" (usar `Map<String, Object>`), se utilizan DTOs estrictamente tipados.

```java
// Ejemplo del MatchResponseDTO usando inmutabilidad (Record pattern)
public record MatchResponseDTO(
    Long id,
    String home,
    String away,
    Integer homeScore,
    Integer awayScore,
    String status,
    boolean isStartingSoon
) {
    public static MatchResponseDTO fromEntity(Match match) {
        // Mapea la entidad JPA segura a la respuesta JSON
        return new MatchResponseDTO(
            match.getId(),
            match.getHomeTeam() != null ? match.getHomeTeam().getName() : "Por definir",
            match.getAwayTeam() != null ? match.getAwayTeam().getName() : "Por definir",
            match.getHomeScore(),
            match.getAwayScore(),
            match.getStatus(),
            isStartingSoon(match.getUtcDate())
        );
    }
}
```

---

## 4. Controladores (API REST) - `/controller`

Los controladores gestionan las peticiones HTTP y delegan el trabajo pesado a los servicios. Responden exclusivamente con JSON.

*   **`MatchController`**: Expone endpoints como `/api/matches/live` o `/api/matches/radar`. Intercepta peticiones, invoca a `MatchService` y mapea entidades a `MatchResponseDTO`.
*   **`PredictionController`**: Permite crear, listar y borrar pronosticos. Valida los payloads usando Jakarta Validation (`@Valid` en `PredictionDataDTO`).
*   **`StandingsController`**: Devuelve la clasificación oficial de los grupos generada algorítmicamente.
*   **`LeaderboardController`**: Devuelve el ranking de los usuarios basado en los aciertos de sus predicciones frente a la realidad.

---

## 5. Lógica de Negocio (Servicios) - `/service`

Esta es la capa donde reside la inteligencia y los algoritmos críticos.

### A. `StandingsService`
Se encarga de computar la tabla de clasificación de la fase de grupos. Recientemente refactorizado, utiliza un motor `O(N log N)` con pre-caché (`H2HStats`) para gestionar los complejos sistemas de desempates FIFA:
1. Puntos.
2. Diferencia de Goles.
3. Goles a favor.
4. Enfrentamientos directos (Head-to-Head).

### B. `PredictionService`
Recibe los complejos JSON de la fase eliminatoria (Fase de Grupos, Octavos, Cuartos...) y los serializa en base de datos. Utiliza fuertemente la **Stream API** de Java y Optionals para navegar jerarquías sin riesgo de `NullPointerException`. Además, gestiona transacciones (`@Transactional`).

### C. `SyncService`
El motor que se conecta a orígenes de datos de terceros (ej. Football-Data.org) mediante tareas programadas (`@Scheduled`). 
- Parsea el JSON externo.
- Encuentra o crea los equipos (`TeamRepository`).
- Actualiza el marcador (`MatchRepository`).
- Al finalizar, lanza un evento de WebSocket (`webSocketService.sendUpdate("DATA_UPDATED")`) para que los clientes React refresquen sus vistas automáticamente.

### D. `MathematicalStatusCalculator`
Calcula dinámicamente si un equipo está "Matemáticamente Clasificado" o "Matemáticamente Eliminado" comparando los puntos máximos posibles con el estado actual del grupo.

```java
// Ejemplo del corazón transaccional de un Servicio
@Service
@RequiredArgsConstructor
public class BetService {
    private final BetRepository betRepository;

    @Transactional
    public Bet createBet(String email, String participantName, BetDataDTO betData) {
        // 1. Lógica de verificación
        // 2. Mapeo de datos limpios usando Streams
        // 3. Persistencia
        return betRepository.save(newBet);
    }
}
```

---

## 6. Integración Frontend-Backend y Seguridad

1.  **Seguridad Base**: `SecurityConfig` bloquea mutaciones (POST, PUT, DELETE) si la cabecera `Authorization: Bearer <token>` no incluye un JWT válido.
2.  **WebSockets**: El cliente React se suscribe a `/topic/updates`. Cuando el Backend, mediante `SyncService`, detecta un gol, lanza un evento. El Frontend invalida el caché de React Query y solicita el JSON fresco instantáneamente.
3.  **Persistencia y Despliegue**: En producción, Docker compila el React app mediante Vite y ubica los assets (JS, CSS, HTML) dentro de la carpeta `src/main/resources/static` del Backend, logrando que Spring Boot sirva tanto la API como la vista en el mismo puerto `8080`.
