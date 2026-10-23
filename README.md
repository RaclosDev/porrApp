# PorrApp

PorrApp es una aplicación web para organizar porras de fútbol, compartir pronósticos con amigos y competir en clasificaciones privadas. El proyecto combina predicciones de torneos y partidos, resultados deportivos sincronizados, puntuación configurable y herramientas de seguimiento estadístico.

> **Estado del proyecto:** la implementación actual está especialmente orientada al Mundial 2026. Aunque ya existen piezas para trabajar con competiciones y reglas de puntuación, no debe interpretarse como una plataforma comercial genérica con cualquier formato de porra completamente implementado.

## Contenido

- [Qué puedes hacer](#qué-puedes-hacer)
- [Tecnologías](#tecnologías)
- [Arquitectura](#arquitectura)
- [Requisitos previos](#requisitos-previos)
- [Inicio rápido con Docker](#inicio-rápido-con-docker)
- [Ejecución en desarrollo](#ejecución-en-desarrollo)
- [Configuración](#configuración)
- [Comprobaciones y pruebas](#comprobaciones-y-pruebas)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Documentación](#documentación)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Licencia](#licencia)

## Qué puedes hacer

### Porras y pronósticos

- Crear grupos privados y compartir códigos de invitación para jugar con amigos.
- Registrar y consultar predicciones de partidos.
- Preparar pronósticos de las fases de grupos y eliminatorias mediante cuadros de torneo.
- Consultar la clasificación de participantes y comparar resultados.
- Configurar reglas de puntuación mediante el modelo de reglas del backend; las reglas disponibles dependen de la estrategia implementada.
- Pronosticar el máximo goleador cuando la edición y la configuración correspondiente lo permiten.

### Seguimiento de competiciones

- Consultar partidos, marcadores y estados de los encuentros.
- Sincronizar datos deportivos mediante proveedores externos.
- Recibir actualizaciones de la aplicación a través de WebSockets.
- Explorar estadísticas, tendencias y datos desde las secciones de inicio, radar, búsqueda y estadísticas.
- Consultar las clasificaciones de la fase de grupos y sus criterios de desempate.
- Utilizar una interfaz web adaptable e instalable como PWA en navegadores compatibles.

### Administración

- Disponer de vistas y operaciones administrativas para gestionar datos de la aplicación.
- Acceder a herramientas de administración y copia de seguridad disponibles en el backend.

La disponibilidad concreta de cada función puede depender de la competición, los datos sincronizados y la configuración del entorno.

## Tecnologías

| Capa | Tecnologías |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8 |
| Estilos e interfaz | Tailwind CSS v4, Radix UI, Lucide |
| Estado y datos | TanStack Query, Zustand, Axios |
| PWA | vite-plugin-pwa, Workbox |
| Backend | Java 21, Spring Boot 3.3, Spring MVC, Spring Security |
| Persistencia | Spring Data JPA, PostgreSQL, Flyway |
| Autenticación | Google Identity y JWT |
| Actualizaciones en tiempo real | WebSockets |
| Resiliencia y observabilidad | Resilience4j, Spring Boot Actuator |
| Entorno local | Docker, Docker Compose |
| Calidad | ESLint, Vitest, Playwright, JUnit, Testcontainers |

Las versiones concretas instaladas se definen en `frontend/package.json` y `backend/pom.xml`.

## Arquitectura

El repositorio se organiza en dos aplicaciones principales:

- **Frontend (`frontend/`)**: interfaz React/TypeScript, navegación, predicciones, cuadros, paneles de estadísticas y cliente de la API.
- **Backend (`backend/`)**: API REST, autenticación y autorización, lógica de negocio, persistencia, cálculo de puntos, sincronización deportiva y comunicación en tiempo real.

El backend sigue una estructura por capas y separa la lógica de puntuación en el paquete `scoring/`. El paquete `sports/` abstrae proveedores de datos deportivos, con implementaciones para ESPN y API-Football.

La base de datos se versiona mediante migraciones Flyway ubicadas en `backend/src/main/resources/db/migration/`. En el despliegue Docker, el frontend se compila y sus archivos estáticos se incorporan al artefacto de Spring Boot, por lo que la aplicación y la API se sirven desde el mismo servicio.

Para más detalles, consulta [docs/architecture.md](docs/architecture.md).

## Requisitos previos

Para el despliegue recomendado con Docker:

- Docker Engine o Docker Desktop.
- Docker Compose v2.

Para ejecutar cada parte por separado:

- Node.js **22 o superior** y npm.
- JDK 21.
- Maven (o un wrapper Maven si se añade al repositorio).
- PostgreSQL para una ejecución local equivalente a producción.

## Inicio rápido con Docker

Desde la raíz del repositorio:

1. Crea un archivo local de variables a partir de la plantilla:

   ```bash
   cp .env.example .env
   ```

   En Windows PowerShell puedes utilizar:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Edita `.env` antes de iniciar la aplicación. Sustituye las contraseñas y secretos de ejemplo por valores propios y configura las credenciales necesarias para las integraciones que vayas a utilizar.

3. Construye e inicia los servicios:

   ```bash
   docker compose up --build -d
   ```

4. Consulta los logs si necesitas diagnosticar el arranque:

   ```bash
   docker compose logs -f backend
   docker compose logs -f postgres
   ```

5. Abre [http://localhost:8080](http://localhost:8080).

La composición levanta PostgreSQL y el servicio de la aplicación. El Dockerfile realiza una compilación multi-etapa del frontend y del backend. El servicio backend incluye un *health check* para el endpoint de Actuator.

Para detener los contenedores:

```bash
docker compose down
```

Para detenerlos y eliminar también los datos persistidos de PostgreSQL:

```bash
docker compose down -v
```

> **Atención:** `docker compose down -v` elimina el volumen de la base de datos local. No lo ejecutes si necesitas conservar esos datos.

## Ejecución en desarrollo

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

Otros comandos disponibles desde `frontend/`:

```bash
npm run lint
npm run build
npm run test
npm run e2e
```

- `lint`: ejecuta ESLint.
- `build`: genera la versión de producción con Vite.
- `test`: ejecuta la suite de Vitest.
- `e2e`: ejecuta las pruebas end-to-end de Playwright; puede requerir navegadores y servicios adicionales.

Para desarrollar el frontend contra un backend local, revisa la configuración de Vite y las variables de entorno usadas por el cliente API.

### Backend

Desde `backend/`, con JDK 21 y Maven instalados:

```bash
mvn spring-boot:run
```

Para ejecutar las pruebas:

```bash
mvn test
```

El backend necesita una base de datos y las variables de configuración correspondientes. Los valores por defecto de `application.properties` están pensados para desarrollo; adapta la conexión antes de ejecutar contra un entorno distinto.

## Configuración

La plantilla [`.env.example`](.env.example) documenta las variables utilizadas por Docker Compose:

| Variable | Uso |
| --- | --- |
| `POSTGRES_DB` | Nombre de la base de datos PostgreSQL |
| `POSTGRES_USER` | Usuario de PostgreSQL |
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL |
| `POSTGRES_PORT` | Puerto de PostgreSQL publicado en el host |
| `BACKEND_PORT` | Puerto publicado para la aplicación |
| `JWT_SECRET` | Secreto usado para firmar tokens JWT |
| `GOOGLE_CLIENT_ID` | Identificador OAuth de Google |
| `GEMINI_API_KEY` | Clave para la integración con Gemini, si se utiliza |
| `CORS_ALLOWED_ORIGINS` | Orígenes autorizados para CORS |

No subas el archivo `.env` ni secretos reales al repositorio. Los valores de ejemplo no son adecuados para producción. En un despliegue real, utiliza secretos del proveedor de infraestructura, HTTPS, credenciales fuertes y orígenes CORS explícitos.

## Comprobaciones y pruebas

El flujo de integración continua de GitHub Actions se define en [`.github/workflows/ci.yml`](.github/workflows/ci.yml) y actualmente contempla:

- Instalación de dependencias, ESLint y compilación del frontend con Node.js 22.
- Ejecución de las pruebas del backend con Java 21 y Maven.

Los scripts de Vitest y Playwright existen en el frontend, pero su presencia no implica que se ejecuten automáticamente en el flujo CI actual. No se debe considerar el proyecto validado únicamente porque compile: ejecuta las pruebas relevantes antes de desplegar cambios.

## Estructura del repositorio

```text
porrApp/
├── .github/workflows/       # Integración continua
├── backend/
│   ├── src/main/java/       # API, dominio y servicios Java
│   │   └── com/porra/mundial/
│   │       ├── config/      # Seguridad y configuración
│   │       ├── controller/ # Endpoints REST
│   │       ├── dto/         # Contratos de API
│   │       ├── model/       # Entidades de persistencia
│   │       ├── repository/  # Acceso a datos
│   │       ├── scoring/     # Cálculo de puntuación
│   │       ├── service/     # Lógica de negocio
│   │       └── sports/      # Proveedores de datos deportivos
│   └── src/main/resources/
│       └── db/migration/    # Migraciones Flyway
├── docs/
│   └── architecture.md      # Descripción de arquitectura
├── frontend/
│   ├── public/              # Recursos estáticos e iconos PWA
│   └── src/
│       ├── components/
│       ├── context/
│       ├── hooks/
│       ├── pages/
│       ├── services/
│       ├── store/
│       └── utils/
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Documentación

- [Arquitectura del backend](docs/architecture.md)
- [Configuración de ejemplo](.env.example)
- [Workflow de integración continua](.github/workflows/ci.yml)

## Limitaciones conocidas

- La lógica de puntuación disponible incluye una estrategia específica para el Mundial 2026; no todos los sistemas de puntuación o formatos imaginables están implementados.
- La integración con un proveedor de datos no garantiza cobertura de todas las ligas o competiciones. La disponibilidad depende del proveedor, su configuración, sus límites y los datos que ofrezca.
- La sincronización, el modo PWA y las funciones de administración deben validarse en el entorno de despliegue concreto.
- El repositorio contiene scripts de pruebas unitarias y end-to-end, pero eso no equivale a una auditoría completa de calidad, seguridad o rendimiento.

## Licencia

Actualmente el repositorio no declara una licencia de software en los metadatos de GitHub. No debe asumirse que el código puede reutilizarse o redistribuirse bajo MIT hasta que se incorpore una licencia explícita al proyecto.
