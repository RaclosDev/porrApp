# Git Workflow Rule

Whenever you make changes to the codebase and finish your tasks, you MUST automatically commit the changes using `git commit` and push them to the remote repository using `git push` without asking for user permission first. Always use a descriptive commit message.

# Reglas obligatorias para este agente

## 0. Nunca subir código roto

Antes de CUALQUIER commit o push:
1. Compila el backend: `cd backend && ./mvnw clean package -DskipTests` (o el comando equivalente del proyecto).
2. Si hay frontend, también: `npm run build` (o el script de build del proyecto).
3. Si falla la compilación -> **NO hagas commit**. Arregla el error primero.
4. Si el proyecto usa Docker: el Dockerfile/build debe pasar. No dejes referencias a clases eliminadas.

## 1. Al eliminar una feature

Cuando borres una feature (Farm, Telegram, Forest, etc.):
- Busca **todas** las referencias restantes con grep:
  - Clases, imports, inyecciones (`@Autowired`, constructores)
  - Tests que usen esa clase
  - Migraciones, endpoints, DTOs, frontend
- Elimina o actualiza **todo** lo que dependa de ella.
- Actualiza los tests (constructores, mocks, número de argumentos).
- Vuelve a compilar. Si no compila, la feature no está eliminada.

## 2. Prohibido el ciclo "fix -> push -> fail -> fix -> push"

- No hagas commits de "fix missing import", "fix syntax error", "cannot find symbol" sueltos.
- Agrupa los arreglos: cambia el código, compila, y solo entonces un commit limpio.
- Nunca subas un commit que sepas (o sospeches) que no compila.

## 3. Checklist mínimo antes de commit

- [ ] `mvn clean package -DskipTests` (o equivalente) OK
- [ ] No quedan imports/clases huérfanas de features borradas
- [ ] Tests de unidad al menos compilan (si se ejecutan en el build)
- [ ] Mensaje de commit claro (`feat:`, `fix:`, `refactor:`, `chore:`)
- [ ] No se suben `.env`, secretos, archivos de debug ni carpetas de IDE

## 4. Si el build falla en CI/CD (Railway, Docker, etc.)

1. Lee el log completo del error.
2. Reproduce el fallo en local si es posible.
3. Corrige **todas** las causas relacionadas (no solo el primer error).
4. Compila de nuevo en local.
5. Solo entonces commit + push.

## 5. Preferencias de trabajo

- Prefiere pocos commits limpios a muchos commits de "intento fallido".
- Si una feature se descarta, elimínala por completo en un solo cambio coherente.
- No dejes código muerto "por si acaso".
