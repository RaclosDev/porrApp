import { CompetitionTable } from '../../pages/LeagueStandings';
import { hasLeaguePhase, knockoutDrawPendingText } from '../../utils/knockoutDrawPending';

/**
 * Unas eliminatorias sorteadas ronda a ronda aún sin cruces: cuándo empiezan y, si van tras una fase de
 * liga (Champions), cómo va su tabla, para que la liga no se quede en blanco hasta febrero.
 */
export default function KnockoutDrawPending({ externalId }: { externalId: string | null }) {
  const leaguePhase = hasLeaguePhase(externalId);
  const text = knockoutDrawPendingText(externalId);
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
