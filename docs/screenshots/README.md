# Capturas del README

Capturas renovadas en noviembre de 2026 a **430 × 932 px CSS** y densidad 2× (PNG de 860 × 1864), con el tema oscuro por defecto. Muestran la aplicación real, con sus fuentes, estilos y navegación móvil, sobre el [modo demo](https://porrapp.app/demo): cuatro ligas de ejemplo que responden en el navegador con participantes, predicciones y clasificaciones **ficticios**.

| Archivos                                                                | Origen                                                                                                                                                                  |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `league-home`, `matchday`, `league-ranking`, `player-card`, `standings` | Liga de LaLiga por jornadas de la demo. `player-card` es el cromo que se abre al tocar a una participante del ranking.                                                  |
| `home`, `ranking`, `final`, `bracket`, `groups`                         | Porra del Mundial ya terminada de la demo.                                                                                                                              |
| `ufc`                                                                   | Porra de UFC de la demo, con la velada abierta.                                                                                                                         |
| `poker-home`, `poker-table`, `poker-history`, `poker-stats`             | Liga de póker **ficticia** de la propia demo ([`/demo?liga=poker`](https://porrapp.app/demo?liga=poker)): los mismos participantes, un torneo en juego y seis cerrados. |

Los escudos, las banderas y las fotos de los luchadores son los que la aplicación recibe de sus proveedores de datos; las fotos de los participantes son retratos de stock de [randomuser.me](https://randomuser.me). `standings`, `home`, `ranking`, `final`, `groups`, `poker-home` y `poker-stats` no aparecen en el README principal; quedan disponibles para otras páginas.

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

Acepta otra URL base como argumento (por defecto, `http://127.0.0.1:5173`). El script entra en cada liga de la demo, oculta el aviso y el selector de ligas, espera las fuentes y las imágenes visibles, y falla si hay desbordamiento horizontal, errores de la página, texto que nombre la demo, avatares con iniciales en lugar de foto o avisos flotantes. Las fechas de la demo son relativas al día en que se ejecuta.
