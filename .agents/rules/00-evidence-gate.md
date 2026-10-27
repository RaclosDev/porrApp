# 00 — Evidence Gate

Este archivo es la puerta de evidencia. No respondas al usuario sin cumplirlo.

## Antes de afirmar algo

1. Identifica la afirmación.
2. Localiza la evidencia: comando ejecutado, salida de herramienta, test, build o lectura real del archivo.
3. Si no hay evidencia, clasifícala como **UNKNOWN** y dilo.

## Clasificación obligatoria

- **FACT**: observado directamente (comando/test/build).
- **INFERENCE**: deducido de hechos previos.
- **UNKNOWN**: sin evidencia suficiente.

## Cierre de respuesta

Incluye, cuando aplique:

- Qué comandos/herramientas se ejecutaron.
- Su resultado real (OK / error).
- Qué queda sin verificar.

## Prohibido

- Decir "hecho", "arreglado", "desplegado" sin evidencia.
- Ocultar fallos de build o tests.
- Sustituir evidencia por intención.

## Bloqueo

Si no puedes verificar o cumplir algo:

```
BLOQUEADO: <qué> / <por qué> / <qué necesito>
```
