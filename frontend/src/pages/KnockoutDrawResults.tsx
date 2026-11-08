import { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { useCustomLock } from '../hooks/useCustomLock';
import { logosOf } from '../utils/knockoutDraw';
import { isNbaCompetition } from '../utils/nbaPlayoffs';
import KnockoutDrawBoard from '../components/knockout/KnockoutDrawBoard';
import KnockoutDrawPending from '../components/knockout/KnockoutDrawPending';
import PaperLoading from '../components/PaperLoading';

/**
 * Cruces reales de unas eliminatorias sorteadas ronda a ronda (Champions, Copa del Rey…): por ronda,
 * cada cruce con sus partidos, el global y quién pasa.
 */
export default function KnockoutDrawResults() {
  const { activeGroupId, activeCompetitionName, activeCompetitionExternalId, allGames } =
    useAppContext();
  const nba = isNbaCompetition(activeCompetitionExternalId);
  const lock = useCustomLock(activeGroupId);
  const rounds = lock.state?.knockoutRounds ?? [];
  const logos = useMemo(() => logosOf(allGames), [allGames]);

  return (
    <section
      className="view-section active block paper-panel album-sheet landing-tape"
      aria-label={`${nba ? 'Playoffs' : 'Eliminatorias'} de ${activeCompetitionName ?? 'la competición'}`}
    >
      <div className="section-header mb-5 text-center">
        <h2 className="m-0 poster-title">{nba ? 'Playoffs' : 'Eliminatorias'}</h2>
        {activeCompetitionName && <p className="text-muted mt-2">{activeCompetitionName}</p>}
      </div>
      {!lock.state && <PaperLoading label="Cargando cruces…" />}
      {lock.state &&
        rounds.length === 0 &&
        (nba ? (
          <p className="text-center">Los playoffs aún no tienen cruces.</p>
        ) : (
          <KnockoutDrawPending externalId={activeCompetitionExternalId} />
        ))}
      {rounds.length > 0 && <KnockoutDrawBoard rounds={rounds} matches={allGames} logos={logos} />}
    </section>
  );
}
