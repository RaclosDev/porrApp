# Cómo contribuir

PorrApp es un proyecto personal, pero las correcciones y las propuestas son bienvenidas.

## Antes de empezar

- Para un fallo o una idea, abre una [issue](https://github.com/RaclosDev/porrApp/issues) y cuenta qué esperabas y qué ocurre.
- Para una vulnerabilidad, sigue [SECURITY.md](SECURITY.md) y no abras una issue pública.
- Para un cambio grande, comenta primero la propuesta en una issue.
- En issues y pull requests rige el [código de conducta](CODE_OF_CONDUCT.md).

## Preparar el entorno

La guía completa está en [docs/desarrollo.md](docs/desarrollo.md). Necesitas Node.js 22, JDK 21 y PostgreSQL, o solo Docker.

## Hacer un cambio

1. Crea una rama desde `main` con un prefijo que diga qué es: `feat/`, `fix/`, `docs/`, `chore/`.
2. Acompaña el cambio con sus pruebas. La CI exige unos mínimos de cobertura que no pueden bajar.
3. Comprueba en local lo mismo que comprueba la CI:

   ```bash
   (cd frontend && npm run lint && npm run test:coverage && npm run build)
   (cd backend && ./mvnw -B clean test)
   ```

4. Abre un pull request contra `main` y rellena la plantilla.

## Convenciones

- Mensajes de commit con [Conventional Commits](https://www.conventionalcommits.org/es/) y en español: `fix: corrige el cierre de la jornada`.
- Código y nombres en inglés; textos de la interfaz, documentación y comentarios en español.
- Los cambios de base de datos van en una migración nueva de Flyway. Las migraciones ya publicadas no se editan.
- Nada de secretos en el repositorio: la configuración llega por variables de entorno.

Los criterios de calidad y las cifras de cobertura están en [docs/calidad.md](docs/calidad.md).
