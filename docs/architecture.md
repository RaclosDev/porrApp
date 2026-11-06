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
| `service/` | Lógica de negocio, por funcionalidad: `league` (ligas y miembros), `account` (sesión y cuenta), `prediction` (pronósticos, cierres y ranking), `tournament` (competiciones, clasificaciones y cuadro oficial), `sync` (sincronización e importación) y `notification` (WebSocket y avisos push) |
| `scoring/` | Reglas y estrategias de puntuación |
| `sports/` | Proveedores de datos deportivos |

## Flujos principales

### Sincronización de resultados

`SyncService` hace una pasada completa cada `app.sync.interval-ms` (15 min) y, mientras haya partidos en juego, otra solo de esas competiciones cada `app.sync.live-interval-ms` (1 min). Las dos van bajo un mismo cerrojo (`SyncLock`) para no solaparse:

1. Pide los partidos de cada competición a su proveedor a través de `SportsDataProviderRegistry` (hoy, `EspnSportsDataProvider`).
2. `MatchEventProcessor` aplica los cambios de marcador y estado a cada `Match`.
3. Al final de la pasada, y solo si cambió algún resultado del Mundial (o falló el recálculo anterior), se cargan una vez sus partidos y se recalcula todo lo que depende de ellos:
   - `KnockoutBracketService` coloca a los ganadores y perdedores de semifinales en la final y en el partido por el tercer puesto.
   - `StandingsService` recalcula la clasificación de grupos y `MathematicalStatusCalculator` marca a los equipos ya clasificados o eliminados.
4. `WebSocketService` avisa a los clientes (`DATA_UPDATED`, `LEAGUE_UPDATED` o `MATCH_SCORE_UPDATED`) y el frontend invalida las consultas afectadas.

`TopScorerService` refresca la tabla de goleadores cada 30 minutos de forma independiente y una vez por lote de resultados del Mundial. Las imágenes se buscan una vez por jugador; también se cachean temporalmente las búsquedas sin resultado.

La sincronización inicial se lanza después de `ApplicationReadyEvent`, cuando los datos semilla ya están confirmados, mediante un ejecutor gestionado por Spring. Los fallos del proveedor se registran como sincronizaciones incompletas; una respuesta fallida no se interpreta como una jornada sin partidos.

Importar el catálogo y el calendario de una competición recién elegida es cosa de `CompetitionImportService`, que comparte ese cerrojo para no crear el mismo partido a la vez que una pasada.

Los partidos históricos que conservan equipos provisionales de la primera importación se reparan mediante su identificador externo, no deduciendo qué equipo corresponde a un id local. `LegacyFixtureRepairService` consulta y valida el resumen de ESPN fuera de la transacción; después actualiza el mismo partido en una transacción breve, conservando los pronósticos que lo referencian. Cada pasada tiene límites de peticiones y tiempo, comparte el cerrojo de sincronización y retrasa los reintentos fallidos.

La importación manual descarga primero el catálogo y los calendarios, con límites de tamaño y tiempo entre llamadas. Después aplica el lote en una única transacción: si falla un partido o su puntuación, se deshacen todos los cambios. La caché de equipos y los avisos de WebSocket se publican después de confirmar los datos.

En el cliente, los marcadores recibidos por WebSocket actualizan la caché de inmediato. Las consultas derivadas se agrupan durante 100 ms para evitar peticiones repetidas en una ráfaga; al reconectar se vuelven a validar los datos visibles que podrían haber cambiado durante el corte.

### Resultados oficiales y desempates

`OfficialResultsService` monta el cuadro real (grupos, mejores terceros, cruces, podio y pichichi) a partir de los partidos sincronizados. `GroupTiebreaker` ordena a los equipos empatados a puntos según el artículo 13 del reglamento del Mundial 2026: primero los partidos entre los empatados, luego la diferencia de goles y los goles de todo el grupo y después el fair play. La app no guarda el ranking FIFA, así que los empates que llegan a ese criterio se ordenan por nombre. Lo usan la clasificación de cada grupo y el orden de los mejores terceros. Mientras quedan partidos, el estado matemático enumera resultados por puntos y mantiene abiertos los desempates que dependen de goles o tarjetas futuros; no inventa marcadores para declarar un puesto asegurado.

Los cuadros nuevos usan `topologyVersion: 2`, con las ramas del [apéndice A del procedimiento del sorteo de FIFA](https://digitalhub.fifa.com/m/2d1a1ac7bab78995/original/Draw-Procedures-for-the-FIFA-World-Cup-2026.pdf). Una versión ausente equivale a `1`: conserva las posiciones históricas durante la lectura, edición, reinicio y guardado. La versión de un pronóstico existente no se cambia al actualizarlo. En versión 2, el servidor comprueba también que cada clasificado procede de su partido anterior. Los partidos oficiales se colocan por sus antecedentes, nunca por su fecha de inicio; los huecos cuya rama no se puede determinar quedan vacíos.

### Puntuación

`ScoringStrategy` define cómo se puntúa un pronóstico y `ScoringRuleSet` guarda los valores de cada regla. `WorldCup2026ScoringStrategy` puntúa los cuadros completos (grupos, cruces, campeón, pichichi) y `MatchScoringCalculator` los pronósticos jornada a jornada (signo 1X2, marcador exacto y bonus por diferencia de goles). `LeaderboardService` reúne esos resultados en la clasificación de cada liga.

Cada liga tiene sus propios valores, guardados en su edición activa. El administrador los cambia con `PUT /api/groups/{id}/scoring` (`LeagueScoringService`; la Porra Global no se puede cambiar); cada regla es un entero entre 0 y 1000. Si cambian, se vuelven a puntuar los partidos terminados y se invalidan las puntuaciones guardadas para que la clasificación se recalcule con `ScoringStrategy#withRules`.

El pichichi elegido se resuelve a un único jugador entre todos los goleadores de ESPN y solo puntúa si ese jugador es el máximo goleador. Acepta tildes, mayúsculas, nombre completo o corto, "Inicial. Apellido" y erratas pequeñas; un apellido o nombre corto que comparten varios goleadores no puntúa.

### Ligas y pronósticos

- `LeagueService` crea, cambia y borra las ligas (`League`), comprueba quién puede verlas y gestiona los códigos de invitación; `LeagueMembershipService`, sus miembros (`Membership`): altas, bajas, expulsiones, pagos y cesión de la administración. Las rutas siguen bajo `/api/groups`. La Porra Global usa un id fijo (`League.GLOBAL_ID`).
- `LeaguePaymentService` actualiza la membresía y los pronósticos de sus ediciones en una misma transacción, tanto desde la gestión de miembros como desde la ruta de pago de un pronóstico. La autorización de administrador se comprueba antes de delegar.
- `PredictionService` guarda los cuadros completos; `MatchPredictionService`, los pronósticos por partido, con cierre individual cuando empieza cada encuentro.
- El formato de cada liga (`PoolFormat`) decide qué se pronostica: `FULL_BRACKET`, `KNOCKOUTS_ONLY` o `MATCH_DAY`.
- Las nuevas ligas de cuadro del Mundial heredan el cierre que ya usaba el proyecto: 11 de junio de 2026 a las 20:00, hora de Madrid, tanto para cuadro completo como para solo eliminatorias. V50 completa las fechas ausentes de esas ediciones y conserva las fechas explícitas. Las jornadas mantienen su cierre por partido. El instante exacto de cierre ya está bloqueado.
- `MatchdayStatsService` (`GET /api/predictions/matchday/stats`) da, para cada partido ya empezado de una liga por jornadas, el reparto 1X2, los marcadores más repetidos y, al terminar, cuántos acertaron. Solo lo leen los miembros de la liga. Más elegidos y Buscador, en las ligas de cuadro, se calculan en el frontend (`utils/bracketStats.ts`) con los cuadros visibles de la liga.

## Seguridad

- Inicio de sesión con Google: `AuthService` valida el ID token e identifica la cuenta por su `sub` (las cuentas antiguas se asocian por email la primera vez; si el email de la cuenta de Google cambia, se actualiza).
- El filtro resuelve los access tokens por el id estable de la cuenta y entrega su correo actual a los servicios. Un correo antiguo dentro de un JWT no permite acceder a otra cuenta que lo haya recibido después. Los tokens heredados basados solo en correo se aceptan únicamente mientras la cuenta no esté vinculada a un `googleSub`.
- Sesión (`SessionService`): access token JWT de 15 minutos, que el frontend guarda solo en memoria y `JwtAuthFilter` valida en cada petición, y refresh token opaco en una cookie `HttpOnly`, `Secure`, `SameSite=Strict` con `Path=/api/auth/session`. Cada refresco rota el refresh token; si llega uno ya rotado se revoca la sesión entera (su familia). La sesión caduca tras 90 días sin usarse (cada refresco vuelve a contar el plazo), con un tope de un año desde el inicio de sesión, y el logout la revoca en el servidor. Los tokens rotados se guardan 30 días para detectar su reutilización. En la base solo se guarda el SHA-256 del refresh token.
- Traspaso a la app instalada en iPhone (`SessionHandoffService`): iOS 17.2+ copia las cookies de Safari a la app al añadirla a la pantalla de inicio, pero no el localStorage. Con la guía de instalación abierta y sesión iniciada, `POST /api/auth/handoff` deja un código de un solo uso (30 minutos, solo su SHA-256 en la base) en la cookie `HttpOnly` `__Secure-porra_handoff` con `Path=/api/auth/session/handoff`. La primera vez que se abre la app instalada, el frontend llama a `POST /api/auth/session/handoff`, que gasta el código y abre una sesión nueva de la misma cuenta, independiente de la de Safari (compartir el refresh token copiado haría saltar la detección de reutilización).
- El navegador serializa las operaciones que cambian la cookie (inicio, restauración, renovación y cierre de sesión) mediante Web Locks; cuando no están disponibles, mantiene una cola dentro de la pestaña. Un identificador local sin credenciales señala los cambios de cuenta o el cierre de sesión. Las otras pestañas recargan su estado y las peticiones de una sesión anterior se rechazan.
- Las rutas de `/api/auth/` usan la cookie, así que `CsrfOriginFilter` exige además que la petición venga de la propia aplicación (cabecera `Origin` o `Sec-Fetch-Site`). El resto de la API se autentica con la cabecera `Authorization` y no necesita protección CSRF.
- `SecurityConfig` deja públicas las lecturas GET (partidos, clasificación, goleadores, pronósticos, ligas, competiciones y avatares) y el login; el resto de la API requiere sesión. Los controladores y servicios filtran los datos de las ligas privadas (`assertCanView` y similares).
- `RateLimitingFilter` limita las peticiones por IP, con un límite más estricto en el login.

## Despliegue

Flyway valida los checksums en cada arranque y no ejecuta `repair()` automáticamente. Las migraciones V1–V10 son la consolidación por dominio de las 72 originales (V1–V71 y V33.1, en git hasta `e619cc2`) y montan el esquema de producción; las nuevas se numeran desde V11. Una base creada con las migraciones antiguas, incluida una copia local, no valida contra las nuevas: recréala (`docker compose down -v`). Si aparece una discrepancia, compara el script aplicado y el esquema con las migraciones del repositorio y realiza una copia de seguridad antes de una reparación administrativa. No edites migraciones aplicadas ni desactives la validación para arrancar.

El `Dockerfile` compila el frontend con Vite y copia el resultado a los recursos estáticos de Spring Boot, de modo que la API y la aplicación se sirven desde el mismo servicio y puerto. En producción corre en Railway; el health check usa Spring Boot Actuator.

El backend debe correr en **una sola instancia**. Varias piezas guardan su estado en la memoria del proceso: los contadores de `RateLimitingFilter`, las conexiones de `WebSocketService` y las cachés de Caffeine (ranking, ligas, partidos, imágenes de invitación). Con dos réplicas cada una tendría sus propios límites, los avisos en tiempo real solo llegarían a quien esté conectado a la réplica que hizo el cambio y una caché podría servir datos que la otra ya invalidó. Las tareas programadas sí están preparadas (ShedLock sobre PostgreSQL). Para escalar en horizontal habría que llevar ese estado a un almacén compartido, por ejemplo Redis con Bucket4j para los límites, pub/sub para los avisos y una caché distribuida o invalidaciones difundidas.
