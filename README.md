<div align="center">

<img src="docs/screenshots/hero.jpg" alt="PorrApp: predicciones de la jornada, clasificación y cuadro de eliminatorias en la interfaz móvil actual" width="100%">

# PorrApp

**Tu liga con amigos. Del pronóstico del domingo a la partida del jueves.**

Porras multideporte, torneos propios, ligas de póker y marcadores de juegos de mesa, en una PWA con Java y React.

[![Demo en vivo](https://img.shields.io/badge/Probar_la_demo-porrapp.app-2fc4c4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://porrapp.app/demo)
[![CI](https://img.shields.io/github/actions/workflow/status/RaclosDev/porrApp/ci.yml?branch=main&style=for-the-badge&label=CI&logo=githubactions&logoColor=white)](https://github.com/RaclosDev/porrApp/actions/workflows/ci.yml)

Java 21 · Spring Boot 4.1 · React 19 · TypeScript · PostgreSQL

</div>

Proyecto personal de **Carlos Sanz Tomero**, desarrollador full-stack. PorrApp reúne invitaciones, predicciones, resultados y clasificación para que un grupo pueda llevar su liga desde el móvil. Las competiciones oficiales compatibles sincronizan sus resultados; los torneos propios y las partidas tienen gestión manual.

**Para conocer el proyecto:** [abre la demo sin registro](https://porrapp.app/demo), consulta las decisiones técnicas de abajo o entra en la [arquitectura](docs/arquitectura.md). La demo pública entra con una cuenta ficticia en tres ligas de ejemplo (Mundial, LaLiga y UFC) con datos inventados que no se guardan; las capturas enseñan además el póker.

## La app actual

<table>
  <tr>
    <td align="center" width="33%"><img src="docs/screenshots/league-home.png" alt="Inicio de una liga de LaLiga con los partidos de la próxima jornada y sus escudos" width="240"><br><sub><b>Tu liga</b> · la jornada que viene</sub></td>
    <td align="center" width="33%"><img src="docs/screenshots/matchday.png" alt="Predicciones 1X2 de una jornada con las elecciones guardadas y cada partido abierto" width="240"><br><sub><b>Jornadas</b> · cada partido tiene su cierre</sub></td>
    <td align="center" width="33%"><img src="docs/screenshots/league-ranking.png" alt="Podio de la jornada y clasificación general de la liga con los avatares de los participantes" width="240"><br><sub><b>Ranking</b> · general y por jornada</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/ranking.png" alt="Podio y clasificación de una porra del Mundial con veinte participantes" width="240"><br><sub><b>Mundial</b> · podio y desglose por fase</sub></td>
    <td align="center"><img src="docs/screenshots/bracket.png" alt="Cuadro de cuartos de final del Mundial con los equipos clasificados y eliminados" width="240"><br><sub><b>Cuadro</b> · camino hasta la final</sub></td>
    <td align="center"><img src="docs/screenshots/groups.png" alt="Clasificación de los grupos del Mundial con equipos clasificados y eliminados" width="240"><br><sub><b>Grupos</b> · clasificación y desempates</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="frontend/public/landing/porras/poker-mesa-600.webp" alt="Reloj de un torneo de póker con nivel de ciegas, jugadores en mesa y bote" width="240"><br><sub><b>Póker</b> · reloj, ciegas y mesa</sub></td>
    <td align="center"><img src="frontend/public/landing/porras/poker-historico-600.webp" alt="Histórico de un torneo de póker con podio, premios y neto de cada jugador" width="240"><br><sub><b>Histórico</b> · premios y neto por torneo</sub></td>
    <td align="center"><img src="frontend/public/landing/porras/poker-estadisticas-600.webp" alt="Estadísticas de una liga de póker con victorias, torneos y recompras" width="240"><br><sub><b>Estadísticas</b> · victorias, ROI y rachas</sub></td>
  </tr>
</table>

Capturas de la interfaz real con la sesión iniciada, renovadas en noviembre de 2026. Las dos primeras filas muestran ligas reales sobre una copia local de la base de datos, con avatares ilustrados en lugar de las fotos de los participantes; la fila de póker usa datos ficticios. [Origen de las capturas](docs/screenshots/README.md).

## Qué permite hacer

- **Organizar ligas privadas:** invitaciones, miembros, reglas y puntuación propias, con varios administradores por liga. Una misma cuenta puede participar en varias ligas.
- **Elegir cómo competir:** cuadro completo, solo eliminatorias, jornadas, superviviente o Grandes Premios. Las opciones dependen del deporte y la competición.
- **Predecir según el deporte:** 1X2 y marcador en fútbol, series de LoL, sets de tenis (con la foto y la bandera de cada tenista), ganador y resolución de una pelea de UFC, o podio, pole y vuelta rápida en F1. También hay competiciones de baloncesto y fútbol americano.
- **Crear competiciones propias:** equipos, calendario, resultados y cierres de predicciones configurables.
- **Organizar torneos sin porras:** añade hasta 64 personas, equipos o parejas sin cuenta. Genera una liga de ida/vuelta o una eliminatoria aleatoria, por cabezas de serie o con posiciones elegidas; registra resultados y publica un enlace o QR de consulta sin registro. Puedes intercambiar posiciones antes de jugar y corregir resultados sin sobrescribir rondas posteriores ya disputadas.
- **Montar ligas de póker:** torneos recurrentes con reloj de ciegas, sonidos de cambio de nivel y modo TV con cola de canciones. Recompras, add-ons, jugadores que se suman con la mesa empezada, reparto de premios editable y pagos para saldar cada torneo. Histórico torneo a torneo y estadísticas con ROI y rachas.
- **Llevar juegos de mesa:** jugadores, días de juego, partidas, rondas y clasificación; puntuación por puntos o victorias, con histórico y corrección de resultados.
- **Seguir la liga:** sincronización de resultados oficiales, recálculo de puntos en el servidor y avisos por WebSocket para refrescar las vistas. Estadísticas y reparto de predicciones en los partidos ya cerrados.
- **Usarla desde el móvil:** PWA instalable, acceso con Google, email y contraseña o llaves de acceso WebAuthn.

## Decisiones técnicas que puedes revisar

| Problema                            | Implementación                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reglas distintas por modalidad      | [Estrategias de puntuación](backend/src/main/java/app/porrapp/scoring) y servicios de dominio separan predicciones, cierres, superviviente y carreras. El marcador de juegos y las ligas de póker tienen servicios propios ([ScoreTrackerService](backend/src/main/java/app/porrapp/service/league/ScoreTrackerService.java), [PokerLeagueService](backend/src/main/java/app/porrapp/service/league/PokerLeagueService.java)). |
| Datos deportivos externos           | La [capa de proveedores](backend/src/main/java/app/porrapp/sports) integra ESPN y LoL Esports. La sincronización programada tiene exclusión mutua con ShedLock y protección frente a fallos externos con Resilience4j.                                                                                                                                                                                                         |
| Pantallas actualizadas sin recargar | El servidor publica cambios por WebSocket y el cliente invalida las consultas afectadas de TanStack Query. La puntuación se calcula en el backend.                                                                                                                                                                                                                                                                             |
| Sesiones entre navegador y PWA      | Access token en memoria, refresh token rotatorio en cookie `HttpOnly`, detección de reutilización y coordinación entre pestañas. [Servicios de cuenta](backend/src/main/java/app/porrapp/service/account) para autenticación y WebAuthn.                                                                                                                                                                                       |
| Persistencia y despliegue           | PostgreSQL con migraciones Flyway. Una imagen Docker compila React y lo sirve desde Spring Boot; GitHub Actions valida los cambios antes del despliegue en Railway.                                                                                                                                                                                                                                                            |

```mermaid
flowchart LR
    PWA[React · PWA] -- REST + JWT --> API[Spring Boot]
    API -- WebSocket --> PWA
    API --> DB[(PostgreSQL · Flyway)]
    API -- sincronización --> Sports[ESPN · LoL Esports]
```

El despliegue actual utiliza **una instancia de backend**: las conexiones WebSocket y las cachés están en memoria. La [guía de arquitectura](docs/arquitectura.md#despliegue) detalla qué habría que compartir antes de escalar horizontalmente.

## Calidad y stack

| Área     | Herramientas y comprobaciones                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend | React 19, TypeScript `strict`, Vite, TanStack Query, Zustand y Tailwind CSS 4. Vitest y Testing Library para lógica y componentes; Playwright para recorridos en móvil y escritorio. |
| Backend  | Java 21, Spring Boot 4.1, Spring Security y JPA. JUnit, Mockito y Testcontainers con PostgreSQL; JaCoCo exige al menos un 80 % de cobertura de líneas.                               |
| Entrega  | GitHub Actions selecciona los jobs según el área modificada. ESLint, Prettier, comprobación de tipos, tests y construcción Docker forman parte del flujo de validación.              |

Los comandos y requisitos están en la [guía de desarrollo](docs/desarrollo.md); la [CI](https://github.com/RaclosDev/porrApp/actions/workflows/ci.yml) permite comprobar su estado actual.

## Ejecutarla en local

Requiere Docker y Docker Compose. Crea el archivo de configuración y completa sus variables, incluidos `JWT_SECRET` y `GOOGLE_CLIENT_ID`:

```bash
cp .env.example .env
docker compose up --build -d
```

La aplicación se sirve en [localhost:8080](http://localhost:8080). Para trabajar con Java y Node por separado, configurar proveedores o ejecutar tests, consulta [docs/desarrollo.md](docs/desarrollo.md).

## Autor

**Carlos Sanz Tomero** · Desarrollo full-stack con Java y React.

[Portfolio](https://raclosdev.github.io/) · [LinkedIn](https://www.linkedin.com/in/carlos-sanz-tomero/) · [GitHub](https://github.com/RaclosDev)

Código publicado bajo [licencia MIT](LICENSE).
