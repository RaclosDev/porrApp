# Verificación y límites del proyecto

## Comprobaciones reproducibles

El workflow de GitHub Actions es la referencia de los controles exigidos. En frontend comprueba formato, tipos, lint, pruebas con cobertura, build y pruebas de Chromium sobre esa build. En backend ejecuta JUnit, las integraciones con PostgreSQL y los mínimos de JaCoCo. La comprobación previa de Docker impide que CI quede verde omitiendo las integraciones por falta de contenedores.

Para una medición limpia del backend, ejecuta `./mvnw -B clean test` (en Windows, `.\mvnw.cmd -B clean test`). Para el frontend: `npm ci`, `npm run lint`, `npm run test:coverage`, `npm run build`, `npx playwright install chromium` y `npm run test:e2e`. No hacen falta credenciales de producción.

Los umbrales actuales conservan la cobertura observada durante la revisión del 31 de octubre de 2026. Se pueden subir conforme crezcan las pruebas; no deben bajarse para hacer pasar un cambio sin explicar qué cobertura se pierde.

## Qué prueban los distintos niveles

- Las pruebas unitarias verifican reglas de puntuación, permisos, estado de sesión, consultas y comportamiento de componentes.
- Las pruebas de concurrencia usan respuestas diferidas para comprobar cambios de cuenta, orden de las operaciones de sesión, pagos simultáneos y respuestas de una liga que llegan después de seleccionar otra. Las ráfagas de WebSocket se prueban con consultas activas, contando peticiones y cancelaciones.
- Las integraciones con PostgreSQL verifican migraciones, restricciones reales, persistencia y arranque de Spring. También comprueban que una importación fallida revierte partidos y puntuaciones, conserva las cachés anteriores y no emite actualizaciones de resultados. Un mock de repositorio no reproduce restricciones únicas ni el orden de las escrituras de Hibernate.
- Las pruebas de la PWA usan Cache Storage y un service worker real en Chromium. Comprueban que una actualización borra la caché antigua de la API y que una petición sin conexión no recupera datos privados de otra sesión.
- Las pruebas de interfaz cubren la portada, el diálogo de acceso y la entrada y salida de la demo, en tamaños de escritorio y móvil. También fuerzan una carga lenta de la liga y un fallo recuperable, y comprueban el reintento sin cambiar de pantalla y la preferencia de movimiento reducido. También comprueban que las cargas de datos posteriores conservan las hojas de papel y que el selector de equipos mantiene un contraste mínimo de 4,5:1, permite seleccionar y no desborda en móvil ni escritorio. La API está simulada y los servicios externos bloqueados. No comprueban el consentimiento de Google, todas las pantallas, ni todos los navegadores.

## Límites conocidos

- Google OAuth necesita un cliente y orígenes autorizados propios para un despliegue independiente. La demo pública permite explorar la aplicación sin registro.
- El control de pagos registra estados dentro de la liga; no procesa cobros.
- Los resultados dependen de ESPN. Una caída o un retraso de ese proveedor puede dejar información desactualizada; el health check de vida no certifica la frescura de los marcadores.
- El último desempate por ranking FIFA no está modelado: los empates que llegan a ese criterio se ordenan por nombre, como se detalla en la arquitectura.
- La PWA conserva recursos estáticos, pero la API necesita conexión. No se prometen lecturas privadas ni guardados de predicciones sin conexión.
- La cobertura mide código ejecutado por las pruebas, no corrección completa. Una revisión de seguridad del repositorio tampoco equivale a un pentest independiente del despliegue.

## Dependencias

Se mantienen los lockfiles y se revisa el efecto de cada cambio de dependencia. `npm audit --omit=dev` revisa el árbol del frontend que se distribuye; `npm audit` incluye las herramientas de build y pruebas.

A 31 de octubre de 2026, el árbol de producción del frontend no presenta avisos en `npm audit --omit=dev`. El árbol de desarrollo conserva un aviso de severidad baja de `deepmerge`, usado transitivamente por la generación de la PWA; npm lo propaga a sus dependientes. El [aviso GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) describe el problema. No se aplica el downgrade incompatible de `vite-plugin-pwa` que propone `npm audit fix --force`: los datos de build proceden del repositorio y no se ha identificado una ruta de explotación desde la API de la aplicación. Esto es una evaluación de alcance, no una corrección de la dependencia; hay que reevaluarla cuando exista una actualización compatible.
