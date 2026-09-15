# Checklist: Repo listo para portfolio

Esta regla define los estándares de calidad y limpieza que deben tener todos los repositorios de este workspace para mantener un perfil profesional de cara a recruiters y entrevistas técnicas. Siempre debes comprobar y asegurar estos puntos cuando trabajes en mis proyectos.

## 1. Estructura limpia
- Solo archivos necesarios (nada de `test_debug_*`, `out.txt`, `.class`, etc.)
- Carpetas de IDE nunca subidas (`.idea/`, `.vscode/`, `*.iml`)
- `node_modules/`, `target/`, `dist/` correctamente ignorados
- Archivos generados (PWA service workers, builds, etc.) fuera del repo

## 2. Seguridad básica
- Ningún `.env` real en el repositorio
- Existe un `.env.example` con valores de ejemplo (sin secretos)
- Contraseñas, API keys, Client IDs → solo en variables de entorno o secrets del hosting
- `.gitignore` incluye `.env`, `.env.*`, `!.env.example`

## 3. Documentación
- `README.md` claro y actualizado
- Explica qué es el proyecto en 2-3 líneas
- Lista de features principales
- Tech stack
- Cómo arrancarlo (pasos claros)
- (Opcional) Capturas o GIF del funcionamiento
- Licencia (MIT suele estar bien)

## 4. Código y calidad
- Nombres de archivos y carpetas coherentes
- No hay código muerto evidente o scripts one-off
- Commits con mensajes razonables (no "asdf", "fix", "tmp")
- Si hay Docker → `docker-compose.yml` funciona y está documentado

## 5. Presentación en GitHub
- Descripción del repo rellenada (la que sale debajo del nombre)
- Topics/tags relevantes (ej: react, spring-boot, jwt, pwa)
- Si es proyecto destacado → fijarlo en tu perfil
- `README` con algo de formato (títulos, listas, badges opcionales)

## 6. Extra que suma puntos
- Demo en vivo (Vercel, Railway, Fly.io, etc.)
- Badge de "Live Demo" en el README
- Estructura clara (frontend/, backend/, docs/…)
- Tests básicos (aunque sean pocos)
