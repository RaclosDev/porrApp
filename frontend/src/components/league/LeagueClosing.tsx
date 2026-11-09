import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Share2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { myLeagueSummariesQuery } from '../../services/queries';
import { copyWithToast } from '../../utils/leagueInvite';
import {
  closingHeadline,
  closingLink,
  closingResultText,
  closingShareText,
  leagueClosing,
} from '../../utils/leagueClosing';
import InkStamp from '../InkStamp';
import MatchdayPodium from '../MatchdayPodium';

/**
 * Cierre de una liga terminada, en lo alto de su inicio: campeón, podio, cómo ha quedado el usuario y
 * un resumen para compartir. Solo lo ven sus miembros: que ha terminado lo dice el resumen de «mis ligas».
 */
export default function LeagueClosing() {
  const { isAuthenticated, activeGroupId, activeGroupName, activeCompetitionName, userId } =
    useAppContext();
  const { data: summaries } = useQuery(myLeagueSummariesQuery(isAuthenticated));
  const finished = Boolean(
    activeGroupId &&
    summaries?.find((summary) => String(summary.groupId) === String(activeGroupId))?.finished,
  );
  const { generalValidResults, loading } = useLeaderboard();
  const closing = useMemo(
    () => leagueClosing(generalValidResults, userId),
    [generalValidResults, userId],
  );

  if (!finished || !activeGroupId || loading) return null;

  const leagueName = activeGroupName || 'La liga';

  const share = async () => {
    const text = closingShareText(closing, leagueName, activeCompetitionName);
    const url = closingLink(activeGroupId);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Final de ${leagueName}`, text, url });
        return;
      } catch (error) {
        // Cancelar el diálogo nativo no debe copiar el resumen por sorpresa.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    await copyWithToast(`${text}\n${url}`, 'Resumen copiado');
  };

  return (
    <section
      className="league-closing paper-panel album-sheet"
      aria-labelledby="league-closing-title"
    >
      <InkStamp tone="gold" size="md">
        Liga terminada
      </InkStamp>
      <h2 id="league-closing-title" className="league-closing-title poster-title">
        {closingHeadline(closing.champions, leagueName)}
      </h2>
      <MatchdayPodium rows={generalValidResults} label="Podio final" />
      {closing.places.length === 0 && (
        <p className="league-closing-result">Nadie ha puntuado en esta liga.</p>
      )}
      {closing.me && <p className="league-closing-result">{closingResultText(closing.me)}</p>}
      {/* Acciones del cierre. Aquí irá «Repetir liga» cuando una liga pueda seguir en otra temporada. */}
      <div className="league-closing-actions">
        <button type="button" className="league-closing-share" onClick={share}>
          <Share2 size={18} aria-hidden="true" />
          Compartir resultado
        </button>
        <Link to="/ranking" className="league-closing-link">
          Ver clasificación
        </Link>
      </div>
    </section>
  );
}
