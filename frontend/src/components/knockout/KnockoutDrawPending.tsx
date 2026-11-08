import { CompetitionTable } from '../../pages/LeagueStandings';

/** Competiciones con fase de liga antes de las eliminatorias: su tabla decide quién juega cada ronda. */
const LEAGUE_PHASE = new Set(['uefa.champions', 'uefa.europa', 'uefa.europa.conf']);

/**
 * Unas eliminatorias sorteadas ronda a ronda aún sin cruces: cuándo empiezan y, si van tras una fase de
 * liga (Champions), cómo va su tabla, para que la liga no se quede en blanco hasta febrero.
 */
export default function KnockoutDrawPending({ externalId }: { externalId: string | null }) {
  const leaguePhase = LEAGUE_PHASE.has(externalId ?? '');
  const text = leaguePhase
    ? 'Las eliminatorias empiezan al acabar la fase de liga: los 8 primeros van a octavos y del 9.º al 24.º juegan el playoff. Podrás predecir cada ronda en cuanto se sortee.'
    : externalId === 'esp.copa_del_rey'
      ? 'Se predice desde dieciseisavos: las rondas anteriores no cuentan. Podrás predecir cada ronda en cuanto se sortee.'
      : 'Aún no se han sorteado los cruces: podrás hacer tu predicción en cuanto se conozcan.';
  return (
    <>
      <p className="paper-panel album-sheet p-5 text-center max-w-145 mx-auto">{text}</p>
      {leaguePhase && (
        <div className="mt-5">
          <CompetitionTable />
        </div>
      )}
    </>
  );
}
