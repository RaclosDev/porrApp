# Capturas del README

Capturas móviles (390 × 844 px CSS, densidad 2×) de la [demo pública](https://porrapp.app/demo), una liga real en modo de solo lectura. Se oculta el aviso del modo demo; el resto es la interfaz tal cual.

`hero.jpg` es la composición de la cabecera del README y se monta a partir de `home.png`, `ranking.png` y `bracket.png`.

## Regenerarlas

Desde la raíz, con Node.js 22+:

```bash
npm --prefix frontend ci
npx --prefix frontend playwright install chromium
node docs/screenshots/capture.mjs                         # contra porrapp.app
node docs/screenshots/capture.mjs http://localhost:5173   # o contra un entorno local
```

El script sobrescribe `landing`, `home`, `ranking`, `prediction`, `bracket` y `groups`.
