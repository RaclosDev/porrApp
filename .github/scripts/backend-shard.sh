#!/usr/bin/env bash
# Reparte las clases de test del backend entre N grupos con tiempos medidos (mayor primero, al grupo con menos carga).
# Uso: backend-shard.sh <grupo 0..N-1> <N>; imprime las clases separadas por comas. Las clases nuevas pesan 5 s.
set -euo pipefail
shard=$1
count=$2
cd "$(dirname "$0")/../.."
weights=.github/ci/backend-test-weights.txt
find backend/src/test -name '*Test.java' -printf '%f\n' | sed 's/\.java$//' \
  | awk -v w="$weights" 'BEGIN { while ((getline l < w) > 0) { split(l, a, " "); t[a[1]] = a[2] } }
      { print ($0 in t ? t[$0] : 5), $0 }' \
  | sort -k1,1nr -k2 \
  | awk -v s="$shard" -v n="$count" '{ m = 0; for (i = 1; i < n; i++) if (load[i] < load[m]) m = i; load[m] += $1; if (m == s) print $2 }' \
  | paste -sd,
