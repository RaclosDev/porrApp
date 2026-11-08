/**
 * Agregados de los cuadros de una liga (Más elegidos y Buscador) y su comparación con el
 * cuadro oficial. Todo es puro: recibe los pronósticos visibles y el cuadro oficial
 * (`/api/world-cup/official-bracket`, que tiene la misma forma que un pronóstico).
 *
 * Cómo se lee un cuadro:
 * - `groups[g]` = [1º, 2º, 3º]; los 3º que pasan están en `thirds`.
 * - `r32` son los cruces de dieciseisavos (vacío en los cuadros antiguos, que se deducen
 *   de los grupos); `r16`, `qf` y `sf` son los equipos que llegan a octavos, cuartos y semis.
 * - `final` son los dos finalistas y `champion`, el campeón.
 *
 * Repartido por temas en `utils/stats/`; este fichero es el punto de entrada.
 */
export * from './stats/entries';
export * from './stats/rankings';
export * from './stats/official';
export * from './stats/search';
