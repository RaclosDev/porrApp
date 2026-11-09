# Desarrollo, pruebas y CI

Guía para ejecutar PorrApp en local, configurarlo y verificar los cambios. La arquitectura del backend está en [architecture.md](architecture.md).

## Ejecutar en local

### Con Docker

```bash
cp .env.example .env   # rellena JWT_SECRET y GOOGLE_CLIENT_ID
docker compose up --build -d
```

La app queda en [http://localhost:8080](http://localhost:8080). `docker compose down -v` borra también la base de datos local.

En PowerShell, usa `Copy-Item .env.example .env`. Crea un cliente OAuth de tipo web en Google y autoriza `http://localhost:8080` y `http://localhost:5173` como orígenes JavaScript. Compose usa el mismo `GOOGLE_CLIENT_ID` para el backend y para compilar el frontend; si lo cambias, vuelve a construir la imagen. El identificador OAuth es público; no hace falta un secreto de cliente.

### Por separado

Requisitos: Node.js 22, JDK 21 y PostgreSQL.

El archivo `.env` de la raíz lo lee Docker Compose; Maven y Vite no lo cargan automáticamente. Para levantar solo PostgreSQL, prepara ese archivo como arriba y ejecuta `docker compose up -d postgres` desde la raíz.

Crea `frontend/.env.local` con `VITE_GOOGLE_CLIENT_ID=tu-identificador.apps.googleusercontent.com` (el mismo identificador del backend). Después, en una terminal:

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173, con /api redirigido a localhost:8080
```

En otra terminal, exporta la configuración del backend. Estos valores de PostgreSQL corresponden a la plantilla; ajústalos si has cambiado `.env`:

```bash
export DATABASE_URL=jdbc:postgresql://localhost:5432/porra_db
export PGUSER=postgres
export PGPASSWORD=mysecretpassword
export JWT_SECRET="$(openssl rand -base64 32)"
export GOOGLE_CLIENT_ID=tu-identificador.apps.googleusercontent.com
cd backend
./mvnw spring-boot:run
```

En PowerShell 7:

```powershell
$env:DATABASE_URL = 'jdbc:postgresql://localhost:5432/porra_db'
$env:PGUSER = 'postgres'
$env:PGPASSWORD = 'mysecretpassword'
$env:JWT_SECRET = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:GOOGLE_CLIENT_ID = 'tu-identificador.apps.googleusercontent.com'
Set-Location backend
.\mvnw.cmd spring-boot:run
```

El backend escucha en el puerto 8080. Mantén estable `JWT_SECRET` entre arranques si quieres conservar la validez de los tokens emitidos.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | Base de datos |
| `BACKEND_PORT` | Puerto de la aplicación |
| `JWT_SECRET` | Firma de los tokens (obligatoria, 32 bytes o más) |
| `GOOGLE_CLIENT_ID` | Google OAuth; Compose lo usa también en la build del frontend |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth en `frontend/.env.local` al ejecutar Vite por separado |
| `CORS_ALLOWED_ORIGINS` | Orígenes permitidos |

La plantilla completa está en [`.env.example`](../.env.example).

## Tests y CI

```bash
(cd frontend && npm run lint && npm run test:coverage && npm run build)
(cd backend && ./mvnw -B clean test)
```

En PowerShell, ejecuta los comandos de npm dentro de `frontend/` y `.\mvnw.cmd -B clean test` dentro de `backend/`.

Las pruebas de navegador usan la build de producción, sin cuentas ni datos reales: en `frontend/`, ejecuta una vez `npx playwright install chromium` y después `npm run build && npm run test:e2e`. Incluyen la actualización de la PWA, el aislamiento de datos privados sin conexión y la navegación de portada, diálogo de acceso y demo en escritorio y móvil. Las pruebas de interfaz simulan la API; no sustituyen la comprobación del OAuth real.

`npm run lint` incluye la comprobación de tipos (`tsc --noEmit` en modo `strict`). En el backend, los tests de migraciones y el de arranque completo levantan un PostgreSQL real con Testcontainers (se saltan si no hay Docker). La cobertura queda en `frontend/coverage/` y `backend/target/site/jacoco/`.

La CI exige Docker para que las pruebas de integración no se salten. Los mínimos de cobertura son 52 % de líneas, 50 % de sentencias, 46 % de funciones y 42 % de ramas en frontend; 80 % de líneas y 58 % de ramas en backend. Son mínimos para detectar retrocesos respecto al estado medido, no una garantía de ausencia de errores. Consulta el [alcance de las verificaciones y limitaciones](quality.md).

El workflow de [GitHub Actions](../.github/workflows/ci.yml) ejecuta lo mismo en cada PR y en cada push a `main`, pero solo los jobs de la parte que cambia (lo decide `.github/scripts/detect-changes.sh`): el frontend si cambia `frontend/`, el backend si cambia `backend/` y la imagen Docker si cambian el `Dockerfile` o los manifiestos de dependencias. Un cambio en la propia CI, la ejecución semanal y la manual lo pasan todo. La cobertura de las dos partes queda en el resumen de la ejecución. Railway solo despliega cuando la CI pasa.

## Estructura

```text
backend/src/main/java/app/porrapp/
  config/       seguridad y configuración
  controller/   endpoints REST y WebSocket
  dto/          contratos de la API
  model/        entidades JPA
  repository/   acceso a datos
  scoring/      reglas y estrategias de puntuación
  service/      lógica de negocio y sincronización
  sports/       proveedores de datos deportivos
backend/src/main/resources/db/migration/   migraciones Flyway

frontend/src/
  components/   UI, agrupada por área (groups, league, layout, prediction, evolution, official…)
  context/      datos compartidos de la sesión (TanStack Query)
  hooks/        lógica de cada pantalla
  pages/        rutas
  services/     cliente de la API
  store/        estado local persistente (Zustand)
  types/        tipos del contrato con el backend
  styles/       CSS por área, con el orden de cascada definido en index.css
  utils/        cálculos puros (cuadro, puntos, borradores)
```
