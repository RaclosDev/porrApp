import { useState } from 'react';
import { Check, Trophy } from 'lucide-react';
import { setCustomResult } from '../../../services/api';
import type { Group, Match } from '../../../types/api';
import Flag from '../../Flag';
import {
  formatMatchDate,
  groupByPhase,
  isBye,
  isKnockout,
  type SaveAction,
} from './customCompetition';

type ResultFilter = 'PENDING' | 'DONE' | 'ALL';

const FILTERS: { id: ResultFilter; label: string }[] = [
  { id: 'PENDING', label: 'Pendientes' },
  { id: 'DONE', label: 'Con resultado' },
  { id: 'ALL', label: 'Todos' },
];

/** Marcador de cada partido y, en eliminatorias empatadas, el ganador del desempate. */
export default function CustomResultsTab({
  group,
  matches,
  save,
}: {
  group: Group;
  matches: Match[];
  save: SaveAction;
}) {
  const playable = matches.filter((match) => !isBye(match));
  const pending = playable.filter((match) => !match.finished).length;
  const [filter, setFilter] = useState<ResultFilter>(pending ? 'PENDING' : 'ALL');
  const visible = playable.filter((match) =>
    filter === 'ALL' ? true : filter === 'DONE' ? match.finished : !match.finished,
  );

  return (
    <>
      <div className="league-admin-toolbar">
        <div className="league-admin-filter" role="group" aria-label="Filtrar partidos">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={filter === id ? 'is-active' : ''}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
              {id === 'PENDING' ? ` (${pending})` : ''}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="league-admin-empty">
          <Trophy size={20} aria-hidden="true" />
          <strong>
            {playable.length === 0
              ? 'Aún no hay partidos'
              : filter === 'PENDING'
                ? 'Todos los resultados están al día'
                : 'Ningún partido con resultado'}
          </strong>
          <span>
            {playable.length === 0
              ? 'Crea partidos en la sección Partidos para poder meter sus resultados.'
              : 'Cambia el filtro para ver el resto de partidos.'}
          </span>
        </div>
      ) : (
        groupByPhase(visible).map((section) => (
          <section key={section.label} className="league-admin-card">
            <div className="league-admin-card-head">
              <h3>{section.label}</h3>
              <span className="league-admin-card-meta">{section.matches.length}</span>
            </div>
            <ul className="league-admin-member-list custom-admin-list">
              {section.matches.map((match) => (
                <ResultRow key={match.id} group={group} match={match} save={save} />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

function ResultRow({ group, match, save }: { group: Group; match: Match; save: SaveAction }) {
  const [home, setHome] = useState(match.homeScore?.toString() ?? '');
  const [away, setAway] = useState(match.awayScore?.toString() ?? '');
  const savedWinner =
    match.winner && match.winner === match.away ? match.away_team_id : match.home_team_id;
  const [winnerId, setWinnerId] = useState(
    match.finished && match.homeScore === match.awayScore && savedWinner ? String(savedWinner) : '',
  );
  const tie = home !== '' && away !== '' && Number(home) === Number(away);
  const needsWinner = isKnockout(match) && tie;
  const unchanged =
    match.finished &&
    home === String(match.homeScore) &&
    away === String(match.awayScore) &&
    (!needsWinner || winnerId === String(savedWinner));
  const prefix = `custom-admin-result-${match.id}`;

  return (
    <li className="league-admin-member custom-admin-result">
      <div className="league-admin-member-main">
        <div className="league-admin-member-info">
          <div className="league-admin-member-name custom-admin-fixture">
            <Flag team={match.home} logo={match.homeTeamLogo ?? match.homeLogo} />
            <span>{match.home}</span>
            <span className="text-muted">–</span>
            <Flag team={match.away} logo={match.awayTeamLogo ?? match.awayLogo} />
            <span>{match.away}</span>
          </div>
          <span
            className={`league-admin-member-status ${match.finished ? 'is-paid' : 'is-pending'}`}
          >
            {formatMatchDate(match.date)} · {match.finished ? 'Finalizado' : 'Sin resultado'}
          </span>
        </div>
      </div>
      <form
        className="custom-admin-score"
        onSubmit={(event) => {
          event.preventDefault();
          void save(
            () =>
              setCustomResult(
                group.id,
                match.id,
                Number(home),
                Number(away),
                needsWinner && winnerId ? Number(winnerId) : undefined,
              ),
            `Resultado guardado: ${match.home} ${home}–${away} ${match.away}`,
          );
        }}
      >
        <label htmlFor={`${prefix}-home`} className="sr-only">
          Goles de {match.home}
        </label>
        <input
          id={`${prefix}-home`}
          className="glass-input custom-admin-goals"
          type="number"
          inputMode="numeric"
          min="0"
          max="99"
          required
          value={home}
          onChange={(event) => setHome(event.target.value)}
        />
        <span aria-hidden="true">–</span>
        <label htmlFor={`${prefix}-away`} className="sr-only">
          Goles de {match.away}
        </label>
        <input
          id={`${prefix}-away`}
          className="glass-input custom-admin-goals"
          type="number"
          inputMode="numeric"
          min="0"
          max="99"
          required
          value={away}
          onChange={(event) => setAway(event.target.value)}
        />
        {needsWinner && (
          <>
            <label htmlFor={`${prefix}-winner`} className="sr-only">
              Ganador del desempate
            </label>
            <select
              id={`${prefix}-winner`}
              className="glass-input custom-admin-winner"
              required
              value={winnerId}
              onChange={(event) => setWinnerId(event.target.value)}
            >
              <option value="">¿Quién pasa?</option>
              <option value={match.home_team_id ?? ''}>{match.home}</option>
              <option value={match.away_team_id ?? ''}>{match.away}</option>
            </select>
          </>
        )}
        <button
          type="submit"
          className="league-admin-btn is-primary"
          disabled={home === '' || away === '' || unchanged}
          aria-label={`Guardar resultado de ${match.home} – ${match.away}`}
        >
          <Check size={15} aria-hidden="true" />
          {match.finished ? 'Actualizar' : 'Guardar'}
        </button>
      </form>
    </li>
  );
}
