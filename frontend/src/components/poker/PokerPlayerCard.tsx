import { useMemo, useState, type ReactNode } from 'react';
import CardViewer from '../CardViewer';
import type { PokerSession } from '../../services/endpoints/poker';
import { PokerAvatar, PokerProfileContext, usePokerProfile } from './PokerFaces';
import { euros, percent, pokerStandings, shortDate, signedEuros } from './pokerFormat';

const placeFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const RECENT = 6;

/**
 * Da a toda la liga el perfil de cada jugador: un cromo en grande con sus números en esta liga,
 * calculados con los torneos cerrados (`sessions`, del más reciente al más antiguo).
 */
export function PokerProfiles({
  sessions,
  children,
}: {
  sessions: PokerSession[] | undefined;
  children: ReactNode;
}) {
  const [player, setPlayer] = useState<{ playerId: number; name: string } | null>(null);
  return (
    <PokerProfileContext.Provider value={setPlayer}>
      {children}
      {player && (
        <PokerPlayerCard
          playerId={player.playerId}
          name={player.name}
          sessions={sessions}
          onClose={() => setPlayer(null)}
        />
      )}
    </PokerProfileContext.Provider>
  );
}

/** Nombre que abre el perfil; sin proveedor (vistas sueltas, tests) queda como texto. */
export function PokerPlayerName({
  playerId,
  name,
  className,
  children,
}: {
  playerId: number;
  name: string;
  className?: string;
  children?: ReactNode;
}) {
  const open = usePokerProfile();
  if (!open) return <span className={className}>{children ?? name}</span>;
  return (
    <button
      type="button"
      className={`player-link${className ? ` ${className}` : ''}`}
      onClick={(event) => {
        event.stopPropagation();
        open({ playerId, name });
      }}
      aria-label={`Ver el perfil de ${name}`}
    >
      {children ?? name}
    </button>
  );
}

function PokerPlayerCard({
  playerId,
  name,
  sessions,
  onClose,
}: {
  playerId: number;
  name: string;
  sessions: PokerSession[] | undefined;
  onClose: () => void;
}) {
  const { row, rank, recent } = useMemo(() => {
    const standings = pokerStandings(sessions ?? []);
    const index = standings.findIndex((standing) => standing.playerId === playerId);
    const played = (sessions ?? []).flatMap((session) => {
      const result = session.results.find((entry) => entry.playerId === playerId);
      return result ? [{ id: session.id, date: session.date, place: result.place }] : [];
    });
    return {
      row: index >= 0 ? standings[index] : null,
      rank: index >= 0 ? standings[index].rank : null,
      recent: played.slice(0, RECENT),
    };
  }, [sessions, playerId]);

  const net = row ? row.prizes - row.paid : 0;
  const stats = row
    ? [
        { label: 'Torneos', value: String(row.played) },
        { label: 'Victorias', value: String(row.wins) },
        { label: 'Podios', value: String(row.podiums) },
        { label: 'Puesto medio', value: `${placeFormat.format(row.places / row.played)}.º` },
        { label: 'En premios', value: percent(row.cashes / row.played) },
        { label: 'Premios', value: euros(row.prizes) },
        {
          label: 'Neto',
          value: signedEuros(net),
          tone: net > 0 ? 'is-up' : net < 0 ? 'is-down' : '',
        },
        {
          label: 'Mejor racha',
          value: `${row.bestStreak} ${row.bestStreak === 1 ? 'podio' : 'podios'}`,
        },
      ]
    : [];

  return (
    <CardViewer label={`Perfil de ${name}`} onClose={onClose}>
      <div className={`sticker player-card${rank === 1 ? ' sticker-featured' : ''}`}>
        {rank !== null && <span className="sticker-rank">{rank}.º</span>}
        <PokerAvatar playerId={playerId} name={name} size={112} photoOnly />
        <h2 className="poster-title player-card-name">{name}</h2>
        {row ? (
          <>
            <p className="marker-ink player-card-summary">
              {rank}.º de la liga · {row.wins} {row.wins === 1 ? 'victoria' : 'victorias'}
            </p>
            <dl className="player-card-stats">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt>{stat.label}</dt>
                  <dd className={stat.tone || undefined}>{stat.value}</dd>
                </div>
              ))}
            </dl>
            {recent.length > 0 && (
              <div className="player-card-recent">
                <p>Últimos torneos</p>
                <ol aria-label="Puestos en los últimos torneos, del más reciente al más antiguo">
                  {recent.map((entry) => (
                    <li
                      key={entry.id}
                      className={entry.place <= 3 ? `is-podium-${entry.place}` : undefined}
                      title={shortDate(entry.date)}
                    >
                      {entry.place}.º
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        ) : (
          <p className="poker-note player-card-summary">
            {sessions ? 'Todavía no ha jugado ningún torneo cerrado.' : 'Cargando sus números…'}
          </p>
        )}
      </div>
    </CardViewer>
  );
}
