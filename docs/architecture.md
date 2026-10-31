# Arquitectura del backend

Spring Boot 4.1 sobre Java 21, organizado por capas bajo `com.porra.mundial`. La base de datos es PostgreSQL y el esquema sale entero de las migraciones Flyway de `src/main/resources/db/migration/`.

## Paquetes

| Paquete | Responsabilidad |
| --- | --- |
| `config/` | Seguridad (JWT, filtro de rate limiting), CORS, WebSocket, Flyway, OpenAPI y datos semilla |
| `controller/` | Endpoints REST, handler WebSocket y metadatos/tarjetas de invitación |
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
3. Al final de la pasada, y solo si cambió algún resultado del Mundial (o falló el recálculo anterior), se cargan una vez sus partidos y se recalcula todo lo que depende de ellos:
   - `KnockoutBracketService` coloca a los ganadores y perdedores de semifinales en la final y en el partido por el tercer puesto.
   - `StandingsService` recalcula la clasificación de grupos y `MathematicalStatusCalculator` marca a los equipos ya clasificados o eliminados.
4. `WebSocketService` avisa a los clientes (`DATA_UPDATED`, `LEAGUE_UPDATED` o `MATCH_SCORE_UPDATED`) y el frontend invalida las consultas afectadas.

`TopScorerService` refresca la tabla de goleadores cada 30 minutos de forma independiente y una vez por lote de resultados del Mundial. Las imágenes se buscan una vez por jugador; también se cachean temporalmente las búsquedas sin resultado.

La sincronización inicial se lanza después de `ApplicationReadyEvent`, cuando los datos semilla ya están confirmados, mediante un ejecutor gestionado por Spring. Los fallos del proveedor se registran como sincronizaciones incompletas; una respuesta fallida no se interpreta como una jornada sin partidos.

Los partidos históricos que conservan equipos provisionales de la primera importación se reparan mediante su identificador externo, no deduciendo qué equipo corresponde a un id local. `LegacyFixtureRepairService` consulta y valida el resumen de ESPN fuera de la transacción; después actualiza el mismo partido en una transacción breve, conservando los pronósticos que lo referencian. Cada pasada tiene límites de peticiones y tiempo, comparte el cerrojo de sincronización y retrasa los reintentos fallidos.

### Resultados oficiales y desempates

`OfficialResultsService` monta el cuadro real (grupos, mejores terceros, cruces, podio y pichichi) a partir de los partidos sincronizados. `GroupTiebreaker` ordena a los equipos empatados a puntos según el artículo 13 del reglamento del Mundial 2026: primero los partidos entre los empatados, luego la diferencia de goles y los goles de todo el grupo y después el fair play. La app no guarda el ranking FIFA, así que los empates que llegan a ese criterio se ordenan por nombre. Lo usan la clasificación de cada grupo y el orden de los mejores terceros. Mientras quedan partidos, el estado matemático enumera resultados por puntos y mantiene abiertos los desempates que dependen de goles o tarjetas futuros; no inventa marcadores para declarar un puesto asegurado.

Los cuadros nuevos usan `topologyVersion: 2`, con las ramas del [apéndice A del procedimiento del sorteo de FIFA](https://digitalhub.fifa.com/m/2d1a1ac7bab78995/original/Draw-Procedures-for-the-FIFA-World-Cup-2026.pdf). Una versión ausente equivale a `1`: conserva las posiciones históricas durante la lectura, edición, reinicio y guardado. La versión de un pronóstico existente no se cambia al actualizarlo. En versión 2, el servidor comprueba también que cada clasificado procede de su partido anterior. Los partidos oficiales se colocan por sus antecedentes, nunca por su fecha de inicio; los huecos cuya rama no se puede determinar quedan vacíos.

### Puntuación

`ScoringStrategy` define cómo se puntúa un pronóstico y `ScoringRuleSet` guarda los valores de cada regla. `WorldCup2026ScoringStrategy` puntúa los cuadros completos (grupos, cruces, campeón, pichichi) y `MatchScoringCalculator` los pronósticos jornada a jornada (signo 1X2, marcador exacto y bonus por diferencia de goles). `LeaderboardService` reúne esos resultados en la clasificación de cada liga.

Cada liga tiene sus propios valores, guardados en su edición activa. El administrador los cambia con `PUT /api/groups/{id}/scoring` (`LeagueScoringService`; la Porra Global no se puede cambiar); cada regla es un entero entre 0 y 1000. Si cambian, se vuelven a puntuar los partidos terminados y se invalidan las puntuaciones guardadas para que la clasificación se recalcule con `ScoringStrategy#withRules`.

El pichichi elegido se resuelve a un único jugador entre todos los goleadores de ESPN y solo puntúa si ese jugador es el máximo goleador. Acepta tildes, mayúsculas, nombre completo o corto, "Inicial. Apellido" y erratas pequeñas; un apellido o nombre corto que comparten varios goleadores no puntúa.

### Ligas y pronósticos

- `GroupService` gestiona las ligas (`League`), sus miembros (`Membership`), los códigos de invitación y los pagos. La Porra Global usa un id fijo (`League.GLOBAL_ID`).
- `LeaguePaymentService` actualiza la membresía y los pronósticos de sus ediciones en una misma transacción, tanto desde la gestión de miembros como desde la ruta de pago de un pronóstico. La autorización de administrador se comprueba antes de delegar.
- `PredictionService` guarda los cuadros completos; `MatchPredictionService`, los pronósticos por partido, con cierre individual cuando empieza cada encuentro.
- El formato de cada liga (`PoolFormat`) decide qué se pronostica: `FULL_BRACKET`, `KNOCKOUTS_ONLY` o `MATCH_DAY`.
- Las nuevas ligas de cuadro del Mundial heredan el cierre que ya usaba el proyecto: 11 de junio de 2026 a las 20:00, hora de Madrid, tanto para cuadro completo como para solo eliminatorias. V50 completa las fechas ausentes de esas ediciones y conserva las fechas explícitas. Las jornadas mantienen su cierre por partido. El instante exacto de cierre ya está bloqueado.
- `MatchdayStatsService` (`GET /api/predictions/matchday/stats`) da, para cada partido ya empezado de una liga por jornadas, el reparto 1X2, los marcadores más repetidos y, al terminar, cuántos acertaron. Solo lo leen los miembros de la liga. Más elegidos y Buscador, en las ligas de cuadro, se calculan en el frontend (`utils/bracketStats.ts`) con los cuadros visibles de la liga.

## Seguridad

- Inicio de sesión con Google: `AuthService` valida el ID token e identifica la cuenta por su `sub` (las cuentas antiguas se asocian por email la primera vez; si el email de la cuenta de Google cambia, se actualiza).
- El filtro resuelve los access tokens por el id estable de la cuenta y entrega su correo actual a los servicios. Un correo antiguo dentro de un JWT no permite acceder a otra cuenta que lo haya recibido después. Los tokens heredados basados solo en correo se aceptan únicamente mientras la cuenta no esté vinculada a un `googleSub`.
- Sesión (`SessionService`): access token JWT de 15 minutos, que el frontend guarda solo en memoria y `JwtAuthFilter` valida en cada petición, y refresh token opaco en una cookie `HttpOnly`, `Secure`, `SameSite=Strict` con `Path=/api/auth/session`. Cada refresco rota el refresh token; si llega uno ya rotado se revoca la sesión entera (su familia). La sesión caduca a los 30 días del inicio de sesión y el logout la revoca en el servidor. En la base solo se guarda el SHA-256 del refresh token.
- Las rutas de `/api/auth/` usan la cookie, así que `CsrfOriginFilter` exige además que la petición venga de la propia aplicación (cabecera `Origin` o `Sec-Fetch-Site`). El resto de la API se autentica con la cabecera `Authorization` y no necesita protección CSRF.
- `SecurityConfig` deja públicas las lecturas GET (partidos, clasificación, goleadores, pronósticos, ligas, competiciones y avatares) y el login; el resto de la API requiere sesión. Los controladores y servicios filtran los datos de las ligas privadas (`assertCanView` y similares).
- `RateLimitingFilter` limita las peticiones por IP, con un límite más estricto en el login.

## Despliegue

Flyway valida los checksums en cada arranque y no ejecuta `repair()` automáticamente, tampoco para V38. Las bases que ya pasaron por la reconciliación histórica conservan su historial; una copia antigua con discrepancias debe revisarse antes de actualizar. Si aparece una discrepancia, compara el script aplicado y el esquema con las migraciones del repositorio y realiza una copia de seguridad antes de una reparación administrativa. No edites migraciones aplicadas ni desactives la validación para arrancar.

El `Dockerfile` compila el frontend con Vite y copia el resultado a los recursos estáticos de Spring Boot, de modo que la API y la aplicación se sirven desde el mismo servicio y puerto. En producción corre en Railway; el health check usa Spring Boot Actuator.
