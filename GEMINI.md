# Reglas Absolutas - EVIDENCE FIRST

**Lee `.agents/rules/00-evidence-gate.md` antes de afirmar nada. Sin el cierre, no respondas al usuario.**

Esta configuración es ACTIVA e inviolable para todos los agentes.

## EVIDENCE FIRST
Nunca presentes una acción como realizada si no existe evidencia de que fue realizada. Una intención no es evidencia. Una herramienta disponible no significa que haya sido utilizada. Un archivo existente no significa que haya sido leído.
Si no existe evidencia: NO VERIFICADO.

## FACT / INFERENCE / UNKNOWN
Toda conclusión debe clasificarse como:
- **FACT**: Hecho observado directamente mediante una herramienta, comando o test verificable.
- **INFERENCE**: Conclusión razonable derivada de uno o varios hechos.
- **UNKNOWN**: No existe evidencia suficiente para determinarlo.
Nunca escribas "He comprobado que..." si solamente has inferido algo.

## TOOL TRUTH
Solo puedes declarar USED / EXECUTED / VERIFIED cuando exista evidencia observable de la ejecución de una herramienta (script, MCP, maven, npm, etc). Graphify = discovery. Tests/código = verification.

## NUNCA
1. Force push.
2. Usar `--no-verify`.
3. Relajar controles para conseguir verde (quitar tests, usar `-DskipTests` como verificación final, `@ts-ignore`, `any`).
4. Crear archivos temporales dentro del repo (usa `~/.gemini/antigravity/scratch/`).
5. `git add .` o `git reset --hard` destructivo.
6. Editar una migración Flyway ya aplicada.
7. Escribir en el informe algo no ejecutado o comprobado.

> **Excepción de git para este repo:** `porrApp/AGENTS.md` exige commit + push a `main` al terminar cada cambio. Esa regla prevalece sobre la prohibición genérica de push a `main`. Force push y `--no-verify` siguen prohibidos.

## SIEMPRE
1. Si algo no se puede cumplir (test que falla, ambigüedad): PARA y responde con "BLOQUEADO: <qué> / <por qué> / <qué necesito>".
2. Un informe que dice "no pude" es un buen resultado. Uno que lo oculta es un fallo grave.
3. Editar con herramientas nativas (UTF-8).
4. Evidencia verificable (Ledger de comandos y salidas reales).

## NARRATIVA PASO A PASO
Nunca trabajes en silencio. Debes ir contándole al usuario qué archivos miras, qué deduces de ellos y qué vas a editar antes de hacerlo. Mantén al usuario involucrado en tu proceso deductivo.

## IMPACTO Y GRAFO OBLIGATORIO
Cualquier cambio que pueda afectar a terceros (filtros, DTOs compartidos, configuración) DEBE validarse previamente buscando el nodo en el grafo con `python -m graphify affected "X"` (o `python -m graphify explain "X"`). Asumir que un cambio es seguro sin evidencia del grafo está prohibido.
