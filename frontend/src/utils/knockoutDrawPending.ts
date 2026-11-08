/** Competiciones con fase de liga antes de las eliminatorias: su tabla decide quién juega cada ronda. */
const LEAGUE_PHASE = new Set(['uefa.champions', 'uefa.europa', 'uefa.europa.conf']);

export const hasLeaguePhase = (externalId: string | null | undefined) =>
  LEAGUE_PHASE.has(externalId ?? '');

/** Qué decir mientras unas eliminatorias sorteadas ronda a ronda aún no tienen cruces. */
export function knockoutDrawPendingText(externalId: string | null | undefined): string {
  if (hasLeaguePhase(externalId)) {
    return 'Las eliminatorias empiezan al acabar la fase de liga: los 8 primeros van a octavos y del 9.º al 24.º juegan el playoff. Podrás predecir cada ronda en cuanto se sortee.';
  }
  if (externalId === 'esp.copa_del_rey') {
    return 'Se predice desde dieciseisavos: las rondas anteriores no cuentan. Podrás predecir cada ronda en cuanto se sortee.';
  }
  return 'Aún no se han sorteado los cruces: podrás hacer tu predicción en cuanto se conozcan.';
}

/**
 * Copas sin fase de grupos: todo son eliminatorias, así que no tienen tabla aunque la liga se juegue
 * por jornadas o al superviviente.
 */
export const isKnockoutOnlyCup = (externalId: string | null | undefined) =>
  externalId === 'esp.copa_del_rey';
