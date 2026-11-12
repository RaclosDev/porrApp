import { Link } from 'react-router-dom';
import type { PokerLeagueData, PokerSession } from '../../services/endpoints/poker';
import { PokerAvatar } from './PokerFaces';
import PokerPodium from './PokerPodium';
import {
  euros,
  pokerStandings,
  standingLabel,
  tournamentDate,
  upcomingTournamentDate,
} from './pokerFormat';
import { pokerRoutes } from './pokerRoutes';

export default function PokerHome({
  league,
  sessions,
  loading,
  onRetry,
}: {
  league: PokerLeagueData;
  sessions: PokerSession[] | undefined;
  loading: boolean;
  onRetry: () => void;
}) {
  const { current } = league;
  const live = Boolean(current && current.startedAt !== null);
  const attending = current?.entries.some((entry) => entry.playerId === league.myPlayerId);
  const eliminated = new Set(current?.eliminations);
  const seated = current?.entries.filter((entry) => !eliminated.has(entry.playerId)) ?? [];
  const latest = sessions?.[0];
  const champion = latest?.results[0];
  const podium = pokerStandings(sessions ?? []).slice(0, 3);

  return (
    <div className="home-dashboard-grid">
      <section className="paper-panel album-sheet poker-panel poker-next-card">
        <header className="home-list-header">
          <h2>{live ? 'Torneo en juego' : 'Próximo torneo'}</h2>
        </header>
        {current ? (
          <>
            <p className="poster-title poker-big-date">{upcomingTournamentDate(current.date)}</p>
            <p className="marker-ink poker-state">
              {live ? 'En juego' : attending ? 'Asistencia confirmada' : 'Inscripciones abiertas'}
            </p>
            {seated.length > 0 && (
              <ul className="poker-faces" aria-label={live ? 'En mesa' : 'Confirmados'}>
                {seated.map((entry) => (
                  <li key={entry.playerId}>
                    <PokerAvatar playerId={entry.playerId} name={entry.name} size={48} />
                    <span>{entry.name}</span>
                  </li>
                ))}
              </ul>
            )}
            <dl className="poker-metrics">
              <div>
                <dt>{live ? 'Jugadores en mesa' : 'Jugadores confirmados'}</dt>
                <dd>{seated.length}</dd>
              </div>
              <div>
                <dt>{live ? 'Bote' : 'Entrada'}</dt>
                <dd>{euros(live ? current.potCents : current.settings.buyInCents)}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="poker-note">Aún no hay ningún torneo programado.</p>
        )}
        {(current || league.owner) && (
          <Link className="glass-btn primary-btn" to={pokerRoutes.table.to}>
            {current && !live && !attending ? 'Apuntarme al torneo' : 'Ir a la mesa'}
          </Link>
        )}
      </section>

      {sessions ? (
        <div className="home-dashboard-sidebar">
          <section className="paper-panel album-sheet poker-panel">
            <header className="home-list-header">
              <h2>Último torneo</h2>
              {latest && (
                <Link className="home-link-btn" to={pokerRoutes.history.to}>
                  Ver histórico
                </Link>
              )}
            </header>
            {latest ? (
              <div className="poker-champion">
                {champion && (
                  <PokerAvatar playerId={champion.playerId} name={champion.name} size={64} />
                )}
                <div>
                  {champion && (
                    <p className="poker-champion-name">
                      Ganó <strong>{champion.name}</strong>
                    </p>
                  )}
                  <p className="poker-note first-letter:uppercase">{tournamentDate(latest.date)}</p>
                  <p className="poker-note">
                    {latest.results.length} jugadores · {euros(latest.potCents)} de bote
                  </p>
                </div>
              </div>
            ) : (
              <p className="poker-note">Todavía no se ha cerrado ningún torneo.</p>
            )}
          </section>
          <section className="paper-panel album-sheet poker-panel">
            <header className="home-list-header">
              <h2>Podio de la liga</h2>
              {podium.length > 0 && (
                <Link className="home-link-btn" to={pokerRoutes.statistics.to}>
                  Ver estadísticas
                </Link>
              )}
            </header>
            {podium.length > 0 ? (
              <PokerPodium
                label="Podio de la liga por victorias"
                places={podium.map((row) => ({
                  playerId: row.playerId,
                  name: row.name,
                  value: standingLabel(row),
                }))}
              />
            ) : (
              <p className="poker-note">El podio se estrenará con los primeros resultados.</p>
            )}
          </section>
        </div>
      ) : (
        <section className="paper-panel album-sheet poker-panel">
          <h2>Resultados de la liga</h2>
          <p className="poker-note" role="status">
            {loading ? 'Cargando los resultados…' : 'No se pudieron cargar los resultados.'}
          </p>
          {!loading && (
            <button type="button" className="glass-btn" onClick={onRetry}>
              Reintentar
            </button>
          )}
        </section>
      )}
    </div>
  );
}
