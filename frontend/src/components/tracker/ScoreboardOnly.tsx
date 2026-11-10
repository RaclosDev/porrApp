import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import LeagueLoadState from '../LeagueLoadState';
import { useAppContext } from '../../context/AppContext';

/**
 * Pantalla que solo existe en las ligas de juegos de mesa (la partida, el histórico): mientras se
 * abre la liga, carga; en cualquier otra clase de liga, lleva al inicio.
 */
export default function ScoreboardOnly({
  children,
}: {
  children: (leagueId: string) => ReactNode;
}) {
  const { leagueKind, groupError, activeGroupId } = useAppContext();
  if (leagueKind === 'loading') return <LeagueLoadState />;
  if (leagueKind === 'error') return <LeagueLoadState error={groupError} />;
  if (leagueKind !== 'scoreboard' || !activeGroupId) return <Navigate to="/" replace />;
  return children(activeGroupId);
}
