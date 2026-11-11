# Capturas del README

Capturas renovadas en noviembre de 2026 a **430 × 932 px CSS**, densidad 2× (PNG de 860 × 1864). Se capturan los componentes reales de la aplicación, con sus fuentes, estilos y navegación móvil.

| Archivos                                                        | Origen                                                                                                                                                                                                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `landing`, `home`, `ranking`, `prediction`, `bracket`, `groups` | [Demo pública](https://porrapp.app/demo), en modo de solo lectura y sin cuenta. Solo se oculta el aviso flotante de modo demo; la marca DEMO de la cabecera se conserva.                                                                |
| `league-home`, `matchday`, `scoreboard`                         | Frontend local con respuestas de API interceptadas. Participantes, calendario, predicciones y partidas **ficticios** para mostrar jornadas y juegos de mesa sin acceder a cuentas privadas. La interfaz no se sustituye ni se modifica. |

`hero.jpg` combina capturas de jornadas, ranking y marcador dentro de una composición de teléfonos. El [generador compartido](https://github.com/RaclosDev/RaclosDev/tree/main/scripts) mantiene la misma composición en el perfil y los proyectos. Los datos de las capturas no acreditan el tamaño de la comunidad ni resultados deportivos reales.

## Preparar el navegador

Desde la raíz, con Node.js 22+:

```bash
npm --prefix frontend ci
npx --prefix frontend playwright install chromium
```

## Demo pública

```bash
node docs/screenshots/capture.mjs
```

También acepta una URL base como argumento. El script recorre la portada y la demo, rechaza las cookies opcionales, espera las fuentes y comprueba que no haya desbordamiento horizontal. Sobrescribe los seis PNG de la demo.

## Jornadas y juegos de mesa

Arranca el frontend en una terminal:

```bash
npm --prefix frontend run dev -- --host 127.0.0.1
```

Desde otra terminal:

```bash
node docs/screenshots/capture-local.mjs http://127.0.0.1:5173
```

Este segundo script solo acepta una dirección local. Intercepta todas las peticiones `/api/`, bloquea las conexiones externas salvo fuentes y banderas, y fija la fecha del navegador para que los partidos sigan abiertos al regenerar las imágenes. No necesita backend, credenciales ni base de datos. Comprueba fuentes, ausencia de errores de JavaScript y desbordamiento horizontal antes de guardar los tres PNG.
