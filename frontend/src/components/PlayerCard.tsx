import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import CardViewer from './CardViewer';
import { UserAvatar } from './Avatar';
import ZoomableAvatar from './ZoomableAvatar';
import { useAppContext } from '../context/AppContext';
import { displayRoundLabel } from '../utils/matchday';
import type { MatchdayPoints, ParticipantScore } from '../types/api';

export interface PlayerRef {
  userId?: number | string | null;
  name: string;
  avatarUrl?: string | null;
  /** Pronóstico concreto; sin él se busca el mejor del jugador en la liga activa. */
  predictionId?: number | string | null;
  /** Acción del pie del cromo, p. ej. abrir su predicción desde la clasificación. */
  action?: { label: string; run: () => void };
}

type OpenPlayer = (player: PlayerRef) => void;

const Cards = createContext<OpenPlayer | null>(null);

/** Abre el cromo de un jugador; sin proveedor (vistas sueltas, tests) no hay cromo que abrir. */
export const usePlayerCard = () => useContext(Cards);

const RECENT = 6;
const average = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

/** Monta el cromo de jugador para toda la app: cualquier foto o nombre puede abrirlo. */
export function PlayerCards({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<PlayerRef | null>(null);
  return (
    <Cards.Provider value={setPlayer}>
      {children}
      {player && <PlayerCard player={player} onClose={() => setPlayer(null)} />}
    </Cards.Provider>
  );
}

/**
 * Foto del jugador. Con proveedor abre su cromo (tenga foto o no) y, dentro del cromo, la foto
 * se amplía; sin proveedor se amplía directamente. El clic no pasa a la fila que la contiene.
 */
export function PlayerAvatar({
  url,
  name,
  userId,
  size,
  predictionId,
  action,
}: {
  url: string | null | undefined;
  name: string;
  userId?: number | string | null;
  size?: number;
  predictionId?: number | string | null;
  action?: PlayerRef['action'];
}) {
  const open = usePlayerCard();
  if (!open) return <ZoomableAvatar url={url} name={name} userId={userId} size={size} />;
  return (
    <button
      type="button"
      className="sheet-person-photo"
      onClick={(event) => {
        event.stopPropagation();
        open({ userId, name, avatarUrl: url, predictionId, action });
      }}
      aria-label={`Ver el cromo de ${name}`}
    >
      <UserAvatar url={url} userId={userId} name={name} size={size} />
    </button>
  );
}

/** Nombre que abre el cromo del jugador; sin proveedor queda como texto. */
export function PlayerName({
  name,
  userId,
  avatarUrl,
  predictionId,
  action,
  className,
  children,
}: {
  name: string;
  userId?: number | string | null;
  avatarUrl?: string | null;
  predictionId?: number | string | null;
  action?: PlayerRef['action'];
  className?: string;
  children?: ReactNode;
}) {
  const open = usePlayerCard();
  if (!open) return <span className={className}>{children ?? name}</span>;
  return (
    <button
      type="button"
      className={`player-link${className ? ` ${className}` : ''}`}
      onClick={(event) => {
        event.stopPropagation();
        open({ userId, name, avatarUrl, predictionId, action });
      }}
      aria-label={`Ver el cromo de ${name}`}
    >
      {children ?? name}
    </button>
  );
}

/** Puesto de cada pronóstico pagado por puntos totales; los empates comparten puesto. */
function ranks(rows: ParticipantScore[]) {
  const paid = rows.filter((row) => !row.pending).sort((a, b) => b.total - a.total);
  const byId = new Map<number, number>();
  let rank = 0;
  let previous: number | null = null;
  for (const row of paid) {
    if (row.total !== previous) rank++;
    byId.set(row.id, rank);
    previous = row.total;
  }
  return byId;
}

function matchdayStats(id: number, rows: ParticipantScore[], matchdays: MatchdayPoints[]) {
  const paidIds = rows.filter((row) => !row.pending).map((row) => String(row.id));
  const played = matchdays.filter(
    (matchday) => matchday.finished && String(id) in matchday.pointsByPrediction,
  );
  const entries = played.map((matchday) => {
    const points = matchday.pointsByPrediction[String(id)] ?? 0;
    const best = Math.max(0, ...paidIds.map((key) => matchday.pointsByPrediction[key] ?? 0));
    return { label: displayRoundLabel(matchday.label), points, won: points > 0 && points === best };
  });
  const best = entries.reduce<(typeof entries)[number] | null>(
    (top, entry) => (!top || entry.points > top.points ? entry : top),
    null,
  );
  return {
    count: entries.length,
    wins: entries.filter((entry) => entry.won).length,
    best,
    mean: entries.length
      ? entries.reduce((sum, entry) => sum + entry.points, 0) / entries.length
      : 0,
    recent: entries.slice(-RECENT).reverse(),
  };
}

function PlayerCard({ player, onClose }: { player: PlayerRef; onClose: () => void }) {
  const { leaderboardData, leaderboardMatchdays } = useAppContext();
  const { row, rank, stats } = useMemo(() => {
    const rows = leaderboardData as ParticipantScore[];
    const byRank = ranks(rows);
    const own = rows.filter((entry) =>
      player.predictionId != null
        ? String(entry.id) === String(player.predictionId)
        : player.userId != null && String(entry.userId) === String(player.userId),
    );
    // Con varias predicciones y sin una concreta, la mejor colocada.
    const found = [...own].sort((a, b) => b.total - a.total)[0] ?? null;
    return {
      row: found,
      rank: found ? (byRank.get(found.id) ?? null) : null,
      stats: found ? matchdayStats(found.id, rows, leaderboardMatchdays as MatchdayPoints[]) : null,
    };
  }, [leaderboardData, leaderboardMatchdays, player.predictionId, player.userId]);

  const name = player.name;
  const avatarUrl = player.avatarUrl ?? row?.avatarUrl ?? null;
  const userId = player.userId ?? row?.userId ?? null;
  const subtitle = row?.predictionName && row.predictionName !== name ? row.predictionName : null;
  const cells = row
    ? [
        { label: 'Puntos', value: String(row.total) },
        { label: 'Puesto', value: rank ? `${rank}.º` : 'Sin pagar' },
        ...(stats && stats.count > 0
          ? [
              { label: 'Jornadas ganadas', value: String(stats.wins) },
              { label: 'Media por jornada', value: average.format(stats.mean) },
              ...(stats.best
                ? [{ label: 'Mejor jornada', value: `${stats.best.points} · ${stats.best.label}` }]
                : []),
            ]
          : []),
      ]
    : [];

  return (
    <CardViewer label={`Cromo de ${name}`} onClose={onClose}>
      <div className={`sticker player-card${rank === 1 ? ' sticker-featured' : ''}`}>
        {rank !== null && <span className="sticker-rank">{rank}.º</span>}
        <ZoomableAvatar url={avatarUrl} name={name} userId={userId} size={112} />
        <h2 className="poster-title player-card-name">{name}</h2>
        {subtitle && <p className="marker-ink player-card-summary">{subtitle}</p>}
        {row ? (
          <>
            <dl className="player-card-stats">
              {cells.map((cell) => (
                <div key={cell.label}>
                  <dt>{cell.label}</dt>
                  <dd>{cell.value}</dd>
                </div>
              ))}
            </dl>
            {stats && stats.recent.length > 0 && (
              <div className="player-card-recent">
                <p>Últimas jornadas</p>
                <ol aria-label="Puntos en las últimas jornadas, de la más reciente a la más antigua">
                  {stats.recent.map((entry) => (
                    <li
                      key={entry.label}
                      className={entry.won ? 'is-podium-1' : undefined}
                      title={entry.won ? `${entry.label} · la ganó` : entry.label}
                    >
                      {entry.points}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        ) : (
          <p className="player-card-summary">Aún sin predicción en esta liga.</p>
        )}
        {player.action && (
          <button
            type="button"
            className="glass-btn player-card-action"
            onClick={() => {
              const run = player.action?.run;
              onClose();
              run?.();
            }}
          >
            {player.action.label}
          </button>
        )}
      </div>
    </CardViewer>
  );
}
