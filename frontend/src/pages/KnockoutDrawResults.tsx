import { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { useCustomLock } from '../hooks/useCustomLock';
import { logosOf } from '../utils/knockoutDraw';
import KnockoutDrawBoard from '../components/knockout/KnockoutDrawBoard';
import PaperLoading from '../components/PaperLoading';

/**
 * Cruces reales de unas eliminatorias sorteadas ronda a ronda (Champions, Copa del Rey…): por ronda,
 * cada cruce con sus partidos, el global y quién pasa.
 */
export default function KnockoutDrawResults() {
  const { activeGroupId, activeCompetitionName, allGames } = useAppContext();
  const lock = useCustomLock(activeGroupId);
  const rounds = lock.state?.knockoutRounds ?? [];
  const logos = useMemo(() => logosOf(allGames), [allGames]);

  return (
    <section
      className="view-section active block paper-panel album-sheet landing-tape"
      aria-label={`Eliminatorias de ${activeCompetitionName ?? 'la competición'}`}
    >
      <div className="section-header mb-5 text-center">
        <h2 className="m-0 poster-title">Eliminatorias</h2>
        {activeCompetitionName && <p className="text-muted mt-2">{activeCompetitionName}</p>}
      </div>
      {!lock.state && <PaperLoading label="Cargando cruces…" />}
      {lock.state && rounds.length === 0 && (
        <p className="text-center">Aún no se han sorteado los cruces.</p>
      )}
      {rounds.length > 0 && <KnockoutDrawBoard rounds={rounds} matches={allGames} logos={logos} />}
    </section>
  );
}
