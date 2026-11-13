import { Link } from 'react-router-dom';
import type { PokerLeagueData, PokerSession } from '../../services/endpoints/poker';
import { BadgedAvatar, lastWinnerIds } from './PokerBadges';
import PokerEmpty from './PokerEmpty';
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
  onInvite,
}: {
  league: PokerLeagueData;
  sessions: PokerSession[] | undefined;
  loading: boolean;
  onRetry: () => void;
  onInvite: () => void;
}) {
  const { current } = league;
  const live = Boolean(current && current.startedAt !== null);
  const attending = current?.entries.some((entry) => entry.playerId === league.myPlayerId);
  const eliminated = new Set(current?.eliminations);
  const seated = current?.entries.filter((entry) => !eliminated.has(entry.playerId)) ?? [];
  const latest = sessions?.[0];
  const champion = latest?.results[0];
  const podium = pokerStandings(sessions ?? []).slice(0, 3);
  const crowned = lastWinnerIds(sessions);

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
                    <BadgedAvatar
                      playerId={entry.playerId}
                      name={entry.name}
                      size={48}
                      rebuys={live ? entry.rebuys : 0}
                      addOns={live ? entry.addOns : 0}
                      crowned={crowned.includes(entry.playerId)}
                    />
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
          <PokerEmpty
            icon="cards"
            title="Sin torneo a la vista"
            action={
              league.owner ? { to: pokerRoutes.table.to, label: 'Preparar torneo' } : undefined
            }
          >
            {league.owner
              ? 'Elige fecha, entrada y ciegas; la gente se apunta desde aquí.'
              : 'Cuando se programe el próximo, podrás apuntarte desde aquí.'}
          </PokerEmpty>
        )}
        {current && (
          <Link className="glass-btn primary-btn" to={pokerRoutes.table.to}>
            {current && !live && !attending ? 'Apuntarme al torneo' : 'Ir a la mesa'}
          </Link>
        )}
      </section>

      {sessions?.length === 0 ? (
        <FirstSteps
          invited={league.players.length > 1}
          scheduled={Boolean(current)}
          owner={league.owner}
          onInvite={onInvite}
        />
      ) : sessions ? (
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

/** Hasta cerrar el primer torneo, en vez de tarjetas vacías: qué falta para estrenar la liga. */
function FirstSteps({
  invited,
  scheduled,
  owner,
  onInvite,
}: {
  invited: boolean;
  scheduled: boolean;
  owner: boolean;
  onInvite: () => void;
}) {
  const steps = [
    {
      done: invited,
      title: 'Invita a la gente',
      text: 'Con el QR, el código o el enlace.',
      action: (
        <button type="button" className="glass-btn" onClick={onInvite}>
          Invitar
        </button>
      ),
    },
    {
      done: scheduled,
      title: 'Prepara el primer torneo',
      text: owner ? 'Fecha, entrada, fichas y ciegas.' : 'Lo programa quien organiza la liga.',
      action:
        owner && !scheduled ? (
          <Link className="glass-btn" to={pokerRoutes.table.to}>
            Preparar
          </Link>
        ) : null,
    },
    {
      done: false,
      title: 'Juega y cierra el torneo',
      text: 'El histórico, el podio y las estadísticas se llenan solos.',
      action: null,
    },
  ];
  return (
    <section className="paper-panel album-sheet poker-panel">
      <header className="home-list-header">
        <h2>Primeros pasos</h2>
      </header>
      <ol className="poker-todo">
        {steps.map((step, index) => (
          <li key={step.title} className={step.done ? 'is-done' : undefined}>
            <span className="poker-todo-mark" aria-hidden="true">
              {step.done ? '✓' : index + 1}
            </span>
            <div className="poker-todo-text">
              <p className="poker-todo-title">
                {step.title}
                {step.done && <span className="sr-only"> (hecho)</span>}
              </p>
              <p className="poker-note">{step.text}</p>
            </div>
            {step.action}
          </li>
        ))}
      </ol>
    </section>
  );
}
