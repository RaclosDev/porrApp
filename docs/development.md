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

## Diagnóstico de notificaciones

En **Cuenta → Avisos**, «Activar avisos en este dispositivo» vuelve a registrar el navegador sin cambiar las preferencias. «Probar notificaciones» registra y prueba únicamente ese dispositivo. Si el proveedor devuelve 404/410, se elimina la suscripción caducada y la siguiente activación crea otra.

Un HTTP 2xx de Apple, FCM u otro proveedor confirma la aceptación del envío, no que el móvil lo haya mostrado. El historial guarda esa aceptación. Para confirmar la recepción hay que observar la notificación en el dispositivo; en iPhone/iPad se necesita la app añadida a la pantalla de inicio y permiso de notificaciones. Los modos de concentración y el resumen de notificaciones pueden afectar a su presentación.

| Preferencia | Flujos |
| --- | --- |
| Predicciones pendientes | Partidos y F1, series NBA, Survivor, cambios de cartelera |
| Nuevos miembros | Incorporaciones, nueva temporada, inicio de día de juego |
| Jornada terminada | Fin de jornada y resultados de F1 |

Las entregas se conservan por dispositivo en `push_delivery_retries` (migraciones V58 y V59), aunque otro dispositivo del usuario acepte el aviso. Cada entrega nueva lleva un token aleatorio dentro del mensaje cifrado. El service worker confirma mediante `POST /api/push/receipts` después de que `showNotification()` termine correctamente; no necesita una sesión abierta. El token solo permite confirmar ese aviso y caduca 24 horas después de su plazo de entrega. El endpoint no devuelve datos y comparte el límite de peticiones de `/api/push/`.

El primer acuse de un dispositivo activa `receipts_enabled`. Hasta entonces, la aceptación del proveedor detiene los reintentos: un worker antiguo nunca podría confirmar. A partir de ese primer acuse, las entregas sin confirmar se reintentan aunque el proveedor las aceptase. Hay un máximo de **tres intentos totales**, con esperas de dos y cuatro minutos, sin ampliar la caducidad original. La prueba manual también registra el acuse y permite activar esta capacidad; su TTL de 60 segundos impide reenvíos tardíos.

El trabajador procesa hasta 20 entradas cada minuto. Antes de reintentar comprueba la cuenta, su preferencia y la pertenencia a la liga enlazada. Los registros previos a V59 y los mensajes sin espacio para incluir el token conservan el reintento de errores del proveedor, con espera creciente hasta 30 minutos. Las suscripciones caducadas se eliminan. Los registros con acuse se conservan hasta siete días después de su caducidad para diagnóstico y luego se borran.

Para diagnosticar una entrega, consultar `subscription_id`, `user_id`, `created_at`, `attempts`, `accepted_at`, `received_at`, `receipt_expected` y `finished_at`: `accepted_at` es aceptación del proveedor; `received_at` confirma que el navegador procesó la notificación. Si `finished_at` existe sin `received_at`, no hay confirmación (puede haberse agotado el plazo o los intentos, cancelado por preferencias o tratarse de un worker antiguo). No registrar ni exportar `receipt_token`, endpoints o claves. Un acuse tardío válido sigue actualizando la recepción aunque hayan terminado los reintentos.

El móvil guarda los acuses pendientes si falla la conexión y los recupera al recibir otro push, abrir la app o recuperar conexión con ella abierta. Los reenvíos usan la misma etiqueta y `renotify: false`, de modo que actualizan la tarjeta existente sin repetir el sonido. Si el usuario ya la descartó, un reenvío puede volver a crearla: Web Push exige una notificación visible por mensaje y no garantiza entrega exactamente una vez. El acuse **no demuestra que la persona haya visto el aviso**, ni permite detectar modos de concentración o ajustes de presentación del sistema.

### Permisos por dispositivo (diagnóstico interno)

Tras completar el perfil, la siguiente visita autenticada ofrece activar los avisos. Si siguen pendientes o bloqueados, vuelve a mostrar la ayuda al entrar después de siete días. El plazo se guarda por cuenta y navegador desde que se muestra el aviso; borrar los datos del navegador lo reinicia. Los permisos bloqueados requieren cambiarlos en ajustes; iPhone/iPad sin instalar recibe instrucciones de instalación. La petición nativa solo se ejecuta al pulsar «Activar avisos». No se modifican las categorías elegidas en Cuenta → Avisos.

`POST /api/push/device-state` requiere sesión y registra exclusivamente la cuenta autenticada. `push_device_states` conserva la última observación por cuenta y un identificador aleatorio del navegador, con la fecha del último aviso. Se actualiza al abrir la app, recuperar conexión o volver a ella (máximo una observación sin cambios cada cinco minutos). No hay un listado público ni para administradores de ligas. Los registros se eliminan al borrar la cuenta.

Consulta interna de solo lectura, sin endpoints ni claves de suscripción:

```sql
SELECT u.id AS user_id, u.participant_name, d.device_id,
       COALESCE(d.permission, 'unknown') AS permission,
       d.install_required, d.observed_at, d.last_prompt_at
FROM app_users u
LEFT JOIN push_device_states d ON d.user_id = u.id
ORDER BY u.id, d.observed_at DESC;
```

`denied` significa bloqueado, `default` pendiente y `unsupported` que ese entorno no expone la API. `unknown` significa que aún no se ha observado ningún dispositivo, no que el usuario lo haya rechazado. Consultar siempre `observed_at`: no podemos conocer cambios hechos con la app cerrada. Una cuenta puede tener permisos diferentes en cada navegador. `granted` no acredita una suscripción activa, categorías habilitadas ni recepción; contrastarlo con `push_subscriptions`, preferencias y acuses de entrega. No se detectan modos de concentración ni se identifica físicamente el móvil.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | Base de datos |
| `BACKEND_PORT` | Puerto de la aplicación |
| `JWT_SECRET` | Firma de los tokens (obligatoria, 32 bytes o más) |
| `GOOGLE_CLIENT_ID` | Google OAuth; Compose lo usa también en la build del frontend |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth en `frontend/.env.local` al ejecutar Vite por separado |
| `CORS_ALLOWED_ORIGINS` | Orígenes permitidos |
| `APP_SEED_PAST_TOURNAMENTS` | `true` da de alta torneos ya jugados (Eurocopa 2024) e importa sus partidos al arrancar, para probar en local un torneo con grupos de otra forma con su cuadro y sus grupos completos. Nunca en producción |

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
