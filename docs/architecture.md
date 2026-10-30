# Arquitectura del backend

Spring Boot 4 sobre Java 21, organizado por capas bajo `com.porra.mundial`. La base de datos es PostgreSQL y el esquema sale entero de las migraciones Flyway de `src/main/resources/db/migration/`.

## Paquetes

| Paquete | Responsabilidad |
| --- | --- |
| `config/` | Seguridad (JWT, filtro de rate limiting), CORS, WebSocket, Flyway, OpenAPI y datos semilla |
| `controller/` | Endpoints REST y el handler WebSocket; solo traducen HTTP y devuelven DTOs |
| `dto/` | Contratos de la API (records y clases de respuesta) |
| `model/` | Entidades JPA: `Competition`, `Edition`, `League`, `Membership`, `Match`, `Prediction`, `MatchPrediction`, `GroupStanding`, `Team`, `UserAccount`… |
| `repository/` | Spring Data JPA |
| `service/` | Lógica de negocio |
| `scoring/` | Reglas y estrategias de puntuación |
| `sports/` | Proveedores de datos deportivos |

## Flujos principales

### Sincronización de resultados

`SyncService` se ejecuta con `@Scheduled` (intervalo en `app.sync.interval-ms`) y bajo un `ReentrantLock` para no solaparse:

1. Pide los partidos de cada competición a su proveedor a través de `SportsDataProviderRegistry` (hoy, `EspnSportsDataProvider`).
2. `MatchEventProcessor` aplica los cambios de marcador y estado a cada `Match`.
3. `KnockoutBracketService` coloca a los clasificados en los cruces de eliminatorias.
4. `StandingsService` recalcula la clasificación de grupos y `MathematicalStatusCalculator` marca a los equipos ya clasificados o eliminados.
5. `WebSocketService` avisa a los clientes (`DATA_UPDATED` o `MATCH_SCORE_UPDATED`) y el frontend invalida las consultas afectadas.

`TopScorerService` refresca la tabla de goleadores cada 30 minutos de forma independiente.

### Puntuación

`ScoringStrategy` define cómo se puntúa un pronóstico y `ScoringRuleSet` guarda los valores de cada regla. `WorldCup2026ScoringStrategy` puntúa los cuadros completos (grupos, cruces, campeón, pichichi) y `MatchScoringCalculator` los pronósticos jornada a jornada (signo 1X2, marcador exacto y bonus por diferencia de goles). `LeaderboardService` reúne esos resultados en la clasificación de cada liga.

### Ligas y pronósticos

- `GroupService` gestiona las ligas (`League`), sus miembros (`Membership`), los códigos de invitación y los pagos. La Porra Global usa un id fijo (`League.GLOBAL_ID`).
- `PredictionService` guarda los cuadros completos; `MatchPredictionService`, los pronósticos por partido, con cierre individual cuando empieza cada encuentro.
- El formato de cada liga (`PoolFormat`) decide qué se pronostica: `FULL_BRACKET`, `KNOCKOUTS_ONLY` o `MATCH_DAY`.

## Seguridad

- Inicio de sesión con Google: `AuthService` valida el ID token e identifica la cuenta por su `sub` (las cuentas antiguas se asocian por email la primera vez; si el email de la cuenta de Google cambia, se actualiza).
- Sesión (`SessionService`): access token JWT de 15 minutos, que el frontend guarda solo en memoria y `JwtAuthFilter` valida en cada petición, y refresh token opaco en una cookie `HttpOnly`, `Secure`, `SameSite=Strict` con `Path=/api/auth/session`. Cada refresco rota el refresh token; si llega uno ya rotado se revoca la sesión entera (su familia). La sesión caduca a los 30 días del inicio de sesión y el logout la revoca en el servidor. En la base solo se guarda el SHA-256 del refresh token.
- Las rutas de `/api/auth/` usan la cookie, así que `CsrfOriginFilter` exige además que la petición venga de la propia aplicación (cabecera `Origin` o `Sec-Fetch-Site`). El resto de la API se autentica con la cabecera `Authorization` y no necesita protección CSRF.
- `SecurityConfig` deja públicas solo las lecturas que necesita la demo (partidos, clasificación, goleadores, pronósticos de la Porra Global) y el login; todo lo demás requiere sesión, y los permisos de cada liga se comprueban en el servicio (`assertCanView` y similares).
- `RateLimitingFilter` limita las peticiones por IP, con un límite más estricto en el login.

## Despliegue

El `Dockerfile` compila el frontend con Vite y copia el resultado a los recursos estáticos de Spring Boot, de modo que la API y la aplicación se sirven desde el mismo servicio y puerto. En producción corre en Railway; el health check usa Spring Boot Actuator.
