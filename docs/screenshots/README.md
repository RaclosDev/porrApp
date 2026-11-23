# Capturas del README

Capturas renovadas en noviembre de 2026 a **430 × 932 px CSS** y densidad 2× (PNG de 860 × 1864). Muestran la aplicación real, con sus fuentes, estilos y navegación móvil, sobre el [modo demo](https://porrapp.app/demo): tres ligas de ejemplo que responden en el navegador con participantes, predicciones y clasificaciones **ficticios**.

| Archivos                                                 | Origen                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `league-home`, `matchday`, `league-ranking`, `standings` | Liga de LaLiga por jornadas de la demo.                                         |
| `home`, `ranking`, `final`, `bracket`, `groups`          | Porra del Mundial ya terminada de la demo.                                      |
| `ufc`                                                    | Porra de UFC de la demo, con la velada abierta.                                 |
| `frontend/public/landing/porras/poker-*.webp`            | Imágenes de la portada de la aplicación, con jugadores y torneos **ficticios**. |

Los escudos, las banderas y las fotos de los luchadores son los que la aplicación recibe de sus proveedores de datos; las fotos de los participantes son retratos de stock de [randomuser.me](https://randomuser.me). `standings`, `home`, `ranking` y `final` no aparecen en el README principal; quedan disponibles para otras páginas.

`hero.jpg` combina capturas de jornadas, ranking y cuadro dentro de una composición de teléfonos. El [generador compartido](https://github.com/RaclosDev/RaclosDev/tree/main/scripts) mantiene la misma composición en el perfil y los proyectos. Las capturas no acreditan el tamaño de la comunidad.

## Regenerar

No hacen falta backend, credenciales ni base de datos. Desde la raíz, con Node.js 22+:

```bash
npm --prefix frontend ci
npx --prefix frontend playwright install chromium
npm --prefix frontend run dev -- --host 127.0.0.1
```

Desde otra terminal:

```bash
node docs/screenshots/capture.mjs
```

Acepta otra URL base como argumento (por defecto, `http://127.0.0.1:5173`). El script entra en cada liga de la demo, oculta el selector de ligas, espera las fuentes y las imágenes visibles, y comprueba que no haya desbordamiento horizontal ni errores de la página. Las fechas de la demo son relativas al día en que se ejecuta.
