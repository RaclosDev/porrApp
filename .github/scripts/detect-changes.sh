#!/usr/bin/env bash
# Decide qué jobs de la CI hacen falta según los ficheros que cambian.
# Escribe frontend=, backend= y docker= (true/false) en stdout; el workflow lo vuelca en $GITHUB_OUTPUT.
#
# Entrada por variables de entorno:
#   EVENT_NAME  pull_request | push | cualquier otro (schedule, workflow_dispatch: se ejecuta todo)
#   BASE_SHA    PR: base del PR. Push: commit anterior a la rama (github.event.before).
#   HEAD_SHA    PR: cabeza del PR. Push: github.sha.
set -euo pipefail

emit() {
  echo "frontend=$1"
  echo "backend=$2"
  echo "docker=$3"
}

run_all() {
  echo "Se ejecuta todo: $1" >&2
  emit true true true
  exit 0
}

case "${EVENT_NAME:-}" in
  pull_request) range="${BASE_SHA:-}...${HEAD_SHA:-}" ;;
  push) range="${BASE_SHA:-}..${HEAD_SHA:-}" ;;
  *) run_all "evento ${EVENT_NAME:-desconocido}" ;;
esac

# Rama nueva (before = 000…), push sin base o historial reescrito: no hay con qué comparar.
if [[ -z "${BASE_SHA:-}" || "$BASE_SHA" =~ ^0+$ ]] || ! git cat-file -e "${BASE_SHA}^{commit}" 2>/dev/null; then
  run_all "no hay commit base con el que comparar"
fi

files=$(git diff --name-only "$range")
printf 'Ficheros cambiados:\n%s\n' "${files:-(ninguno)}" >&2

matches() { grep -qE "$1" <<<"$files"; }

# Un cambio en la propia CI lo prueba todo.
if matches '^\.github/(workflows/ci\.yml|scripts/detect-changes\.sh)$'; then
  run_all "cambia la configuración de la CI"
fi

frontend=false
backend=false
docker=false
# Prettier lee .editorconfig además de frontend/.prettierrc.
matches '^(frontend/|\.editorconfig$)' && frontend=true
matches '^backend/' && backend=true
# La imagen solo puede romperse por sí misma si cambia su receta o las dependencias que descarga;
# el código de cada parte ya lo compilan frontend-check (npm run build) y backend-test (mvnw test).
matches '^(Dockerfile|\.dockerignore|docker-compose\.yml|frontend/package(-lock)?\.json|backend/pom\.xml|backend/mvnw|backend/\.mvn/.*)$' && docker=true

emit "$frontend" "$backend" "$docker"
