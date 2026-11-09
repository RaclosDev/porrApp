#!/usr/bin/env bash
# Comprueba las migraciones Flyway de un PR contra su rama base:
#   - una migración que ya está en la base no se modifica, renombra ni borra (ya se aplicó en producción);
#   - cada migración nueva lleva un número mayor que la última de la base, sin repetir.
# Así dos PR que añaden la misma versión no se pisan: el segundo falla al actualizarse con la base.
#
# Entrada por variables de entorno:
#   BASE_SHA  commit de la rama base
#   HEAD_SHA  cabeza del PR
set -euo pipefail

dir="backend/src/main/resources/db/migration"
base="${BASE_SHA:?falta BASE_SHA}"
head="${HEAD_SHA:?falta HEAD_SHA}"

version_of() { sed -E 's#.*/V([0-9]+)__.*#\1#' <<<"$1"; }

fail=0

touched=$(git diff --name-only --diff-filter=MDRT "$base...$head" -- "$dir")
if [[ -n "$touched" ]]; then
  printf 'Migraciones existentes modificadas, renombradas o borradas (no se tocan: añade una nueva):\n%s\n' "$touched" >&2
  fail=1
fi

last=0
while IFS= read -r file; do
  [[ "$file" =~ /V[0-9]+__[^/]*\.sql$ ]] || continue
  version=$(version_of "$file")
  ((10#$version > last)) && last=$((10#$version))
done < <(git ls-tree -r --name-only "$base" -- "$dir")

seen=" "
while IFS= read -r file; do
  [[ -n "$file" ]] || continue
  if [[ ! "$file" =~ /V[0-9]+__[^/]*\.sql$ ]]; then
    echo "Nombre de migración no válido (se espera V<número>__<nombre>.sql): $file" >&2
    fail=1
    continue
  fi
  version=$((10#$(version_of "$file")))
  if ((version <= last)); then
    echo "$file: su número debe ser mayor que V$last, la última migración de la rama base." >&2
    fail=1
  fi
  if [[ "$seen" == *" $version "* ]]; then
    echo "$file: el PR añade dos migraciones con el número V$version." >&2
    fail=1
  fi
  seen+="$version "
done < <(git diff --name-only --diff-filter=A "$base...$head" -- "$dir")

if ((fail)); then exit 1; fi
echo "Migraciones correctas (última de la base: V$last)."
