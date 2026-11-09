import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMatchdayStats } from '../../hooks/useMatchdayStats';
import { useMatchVoters } from '../../hooks/useMatchVoters';
import { isApiError } from '../../services/apiError';
import type { MatchVoter } from '../../types/api';
import {
  favouritePlayers,
  matchPickers,
  playerLogos,
  playerMatches,
  playerSituation,
  searchablePlayers,
  type PlayerMatch,
} from '../../utils/tennisSearch';
import { UserAvatar } from '../Avatar';
import Flag from '../Flag';
import PaperLoading from '../PaperLoading';
import WhatsAppIcon from '../WhatsAppIcon';
import { InsightsNotice } from './InsightCard';
import PickFunnel from './PickFunnel';
import SubjectPicker from './SubjectPicker';

const SHORTCUTS = 6;

const playerOption = (name: string) => ({ value: name, label: name });

/** Lo que pasó de verdad en el partido, visto desde el jugador. */
function realText(row: PlayerMatch): string | null {
  if (row.status === 'pending') return null;
  const score = row.score ? ` ${row.score}` : '';
  return row.status === 'yes' ? `Ganó${score}.` : `Perdió${score}.`;
}

/**
 * Buscador de una liga de tenis: elige un jugador y mira, partido a partido del cuadro, cuántas
 * predicciones lo dan ganador y quién. Solo salen los partidos ya empezados: antes, lo que pone
 * cada uno está oculto.
 */
export default function TennisSearch({
  groupId,
  leagueName,
}: {
  groupId: string;
  leagueName: string;
}) {
  const { data, isPending, error } = useMatchdayStats(groupId);
  const [params, setParams] = useSearchParams();

  const matches = useMemo(() => data?.matches ?? [], [data]);
  const players = useMemo(() => searchablePlayers(matches), [matches]);
  const shortcuts = useMemo(() => favouritePlayers(matches, SHORTCUTS), [matches]);
  const logos = useMemo(() => playerLogos(matches), [matches]);

  const requestedPlayer = params.get('player') ?? '';
  const player = players.includes(requestedPlayer) ? requestedPlayer : '';
  const rows = useMemo(() => (player ? playerMatches(matches, player) : []), [matches, player]);
  const requestedMatch = Number(params.get('match') ?? Number.NaN);
  // Sin partido pedido, el último que ha jugado.
  const row = rows.find((r) => r.matchId === requestedMatch) ?? rows[rows.length - 1];

  const voters = useMatchVoters(groupId, row ? [row.matchId] : []);
  const pickers = row ? matchPickers(voters.get(row.matchId), row.side) : null;

  if (isPending) {
    return <PaperLoading label="Cargando el buscador" embedded />;
  }
  if (error) {
    return (
      <InsightsNotice title="No se han podido cargar las predicciones de la liga">
        {isApiError(error, 403)
          ? 'Solo los miembros de la liga pueden verlas.'
          : 'Comprueba la conexión e inténtalo de nuevo.'}
      </InsightsNotice>
    );
  }
  if (players.length === 0) {
    return (
      <InsightsNotice title="Todavía no hay partidos que mostrar">
        Las predicciones de cada partido se ven en cuanto empieza. Entonces podrás buscar aquí a
        cada jugador.
      </InsightsNotice>
    );
  }

  const update = (next: { player?: string; match?: number }) => {
    const nextPlayer = next.player ?? player;
    const query = new URLSearchParams();
    query.set('group', groupId);
    if (nextPlayer) query.set('player', nextPlayer);
    if (next.match !== undefined && nextPlayer) query.set('match', String(next.match));
    setParams(query, { replace: true });
  };

  const share = () => {
    if (!row) return;
    const url = `${window.location.origin}/search?group=${encodeURIComponent(groupId)}&player=${encodeURIComponent(player)}&match=${row.matchId}`;
    const text = `${player} gana a ${row.rival} (${row.round}): lo pone el ${row.percent} % de "${leagueName}". ¿Quién es quién?\n\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const icon = (name: string) => <Flag team={name} logo={logos[name]} />;
  const situation = playerSituation(rows);
  const real = row ? realText(row) : null;

  return (
    <div className="mx-auto flex max-w-245 flex-col gap-4">
      <SubjectPicker
        value={player}
        onChange={(next) => update({ player: next })}
        groups={[{ label: null, options: players.map(playerOption) }]}
        shortcuts={shortcuts.map(playerOption)}
        icon={icon}
        placeholder="Elige un jugador"
      />

      {!player || !row ? (
        <InsightsNotice title="Elige un jugador">
          Verás en qué partidos del cuadro lo da ganador la liga y quién es. Solo salen los partidos
          que ya han empezado.
        </InsightsNotice>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <section
            aria-labelledby="search-player-title"
            className="min-w-0 rounded-[14px] border border-line bg-panel p-3.5 sm:p-4.5"
          >
            <div className="mb-3 flex items-center gap-2.5">
              {icon(player)}
              <h3 id="search-player-title" className="m-0 min-w-0 flex-1 truncate text-[1.2rem]">
                {player}
              </h3>
              {situation && (
                <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[0.78rem] font-semibold text-muted">
                  {situation}
                </span>
              )}
            </div>
            <PickFunnel
              rows={rows.map((r) => ({
                id: String(r.matchId),
                label: `${r.round}: gana a ${r.rival}`,
                count: r.count,
                total: r.total,
                percent: r.percent,
                status: r.status,
                note: r.tournament ?? undefined,
              }))}
              total={row.total}
              selected={String(row.matchId)}
              onSelect={(id) => update({ match: Number(id) })}
              wrapLabels
            />
          </section>

          <section
            aria-labelledby="search-pickers-title"
            aria-live="polite"
            className="min-w-0 rounded-[14px] border border-line bg-panel p-3.5 sm:p-4.5"
          >
            <h3 id="search-pickers-title" className="m-0 text-[1.05rem]">
              {player} gana a {row.rival}
            </h3>
            <p className="mt-1 mb-3 text-[0.88rem] text-muted">
              {row.round}
              {row.tournament ? ` · ${row.tournament}` : ''} · {row.count} de {row.total}{' '}
              {row.total === 1 ? 'predicción' : 'predicciones'} ({row.percent} %).
              {real ? ` ${real}` : ''}
            </p>
            {pickers && (
              <div className="flex flex-col gap-4">
                <VoterList title="Lo ponen ganador" voters={pickers.yes} highlight />
                {pickers.no.length > 0 && (
                  <VoterList title={`Ponen a ${row.rival}`} voters={pickers.no} />
                )}
              </div>
            )}
            <button
              type="button"
              onClick={share}
              className="glass-btn primary-btn mt-4 inline-flex w-full items-center justify-center gap-2"
            >
              <WhatsAppIcon size={18} /> Compartir búsqueda
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

/** Miembros que han elegido a uno de los dos jugadores del partido. */
function VoterList({
  title,
  voters,
  highlight = false,
}: {
  title: string;
  voters: MatchVoter[];
  highlight?: boolean;
}) {
  return (
    <div>
      <h4 className="m-0 mb-2 text-[0.92rem] font-bold text-main">
        {title} <span className="text-muted">({voters.length})</span>
      </h4>
      {voters.length === 0 ? (
        <p className="m-0 text-[0.9rem] text-muted">Nadie.</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-1.5 p-0 min-[420px]:grid-cols-2 lg:grid-cols-3">
          {voters.map((voter) => (
            <li
              key={voter.userId}
              className={`flex min-h-11 items-center gap-2.5 rounded-[10px] border px-2.5 py-1.5 ${highlight ? 'border-[rgba(11,95,116,0.35)] bg-[rgba(11,95,116,0.08)]' : 'border-line'}`}
            >
              <UserAvatar url={voter.avatarUrl} userId={voter.userId} name={voter.name} size={28} />
              <span className="min-w-0 flex-1 truncate font-semibold text-main">{voter.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
