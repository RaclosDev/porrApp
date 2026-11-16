# Capturas del README

Capturas renovadas en noviembre de 2026 a **430 × 932 px CSS** con la sesión iniciada, tomadas a densidad 3× y reducidas a PNG de 860 × 1864. Muestran la aplicación real, con sus fuentes, estilos y navegación móvil.

| Archivos                                                 | Origen                                                                                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `league-home`, `matchday`, `league-ranking`, `standings` | Liga de LaLiga por jornadas, abierta en local con sesión iniciada sobre una copia de la base de datos. La base de producción solo se lee para hacer la copia. |
| `home`, `ranking`, `groups`, `bracket`, `final`          | Porra del Mundial ya terminada, en las mismas condiciones.                                                                                                    |
| `frontend/public/landing/porras/poker-*.webp`            | Imágenes de la portada de la aplicación, con jugadores y torneos **ficticios**.                                                                               |

Las ligas son reales: se conservan los apodos de los participantes, pero sus fotos se sustituyen por avatares ilustrados de [DiceBear Lorelei](https://www.dicebear.com/styles/lorelei/) (CC0). `standings`, `home` y `final` no aparecen en el README principal; quedan disponibles para otras páginas.

`hero.jpg` combina capturas de jornadas, ranking y cuadro dentro de una composición de teléfonos. El [generador compartido](https://github.com/RaclosDev/RaclosDev/tree/main/scripts) mantiene la misma composición en el perfil y los proyectos. Las capturas no acreditan el tamaño de la comunidad.

## Regenerar sin datos reales

Los dos scripts de esta carpeta producen versiones alternativas sin sesión ni base de datos. Sirven para comprobar la interfaz, pero escriben en esta misma carpeta: revisa `git status` antes de confirmar para no sustituir las capturas publicadas.

Desde la raíz, con Node.js 22+:

```bash
npm --prefix frontend ci
npx --prefix frontend playwright install chromium
```

### Demo pública

```bash
node docs/screenshots/capture.mjs
```

También acepta una URL base como argumento. Recorre la portada y la [demo pública](https://porrapp.app/demo) en modo de solo lectura, rechaza las cookies opcionales, espera las fuentes y comprueba que no haya desbordamiento horizontal. Genera `landing`, `home`, `ranking`, `prediction`, `bracket` y `groups`.

### Jornadas y juegos de mesa con datos ficticios

Arranca el frontend en una terminal:

```bash
npm --prefix frontend run dev -- --host 127.0.0.1
```

Desde otra terminal:

```bash
node docs/screenshots/capture-local.mjs http://127.0.0.1:5173
```

Solo acepta una dirección local. Intercepta todas las peticiones `/api/`, bloquea las conexiones externas salvo fuentes y banderas, y fija la fecha del navegador para que los partidos sigan abiertos. No necesita backend, credenciales ni base de datos. Genera `league-home`, `matchday` y `scoreboard`.
