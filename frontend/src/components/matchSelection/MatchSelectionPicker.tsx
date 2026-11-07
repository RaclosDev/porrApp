import { useId, useMemo, useState } from 'react';
import { Lock, Search } from 'lucide-react';
import type { SelectableMatch, SelectableTeam } from '../../types/api';
import { displayRoundLabel, formatMatchDate } from '../../utils/matchday';
import {
  PICK_MODES,
  groupByRound,
  isSelected,
  matchesQuery,
  switchMode,
  teamsQuery,
  toggleMatch,
  toggleTeam,
  type PickMode,
  type SelectionValue,
} from './matchSelection';

interface Props {
  teams: SelectableTeam[];
  matches: SelectableMatch[];
  value: SelectionValue;
  onChange: (value: SelectionValue) => void;
  /** Id del mensaje de error, para enlazarlo desde el grupo de opciones. */
  errorId?: string;
  /** Id del primer control, para enfocarlo cuando hay un error. */
  fieldId?: string;
}

/**
 * Qué partidos entran en una liga por jornadas: todos, los de unos equipos (con la opción de quitar
 * alguno) o elegidos uno a uno, agrupados por jornada. Las jornadas ya jugadas quedan plegadas.
 */
export default function MatchSelectionPicker({
  teams,
  matches,
  value,
  onChange,
  errorId,
  fieldId,
}: Props) {
  const uid = useId();
  const [teamQuery, setTeamQuery] = useState('');
  const [matchQuery, setMatchQuery] = useState('');
  const [showPlayed, setShowPlayed] = useState(false);

  const selectedCount = useMemo(
    () => matches.filter((match) => isSelected(value, match)).length,
    [matches, value],
  );

  // Con equipos se listan sus partidos (y los añadidos); a mano, todo el calendario.
  const listed = useMemo(() => {
    if (value.mode === 'ALL') return [];
    const base =
      value.mode === 'TEAMS'
        ? matches.filter(
            (match) =>
              isSelected(value, match) ||
              value.excluded.includes(match.id) ||
              value.included.includes(match.id),
          )
        : matches;
    return base.filter((match) => matchesQuery(match, matchQuery));
  }, [matches, value, matchQuery]);
  const rounds = useMemo(() => groupByRound(listed), [listed]);
  const played = rounds.filter((group) => group.closed);
  const upcoming = rounds.filter((group) => !group.closed);
  const visible = showPlayed ? rounds : upcoming;
  const visibleTeams = teams.filter((team) => teamsQuery(team, teamQuery));

  const changeMode = (mode: PickMode) => onChange(switchMode(value, mode, matches));

  return (
    <div className="match-picker">
      <fieldset
        className="match-picker-modes"
        aria-describedby={errorId}
        id={fieldId}
        tabIndex={fieldId ? -1 : undefined}
      >
        <legend className="sr-only">Qué partidos entran en la liga</legend>
        {PICK_MODES.map((mode) => {
          const id = `${uid}-mode-${mode.value}`;
          return (
            <label
              key={mode.value}
              htmlFor={id}
              className={`match-picker-mode${value.mode === mode.value ? ' is-checked' : ''}`}
            >
              <input
                id={id}
                type="radio"
                name={`${uid}-mode`}
                value={mode.value}
                checked={value.mode === mode.value}
                onChange={() => changeMode(mode.value)}
                aria-describedby={`${id}-text`}
              />
              <span>
                <span className="match-picker-mode-title">{mode.title}</span>
                <span id={`${id}-text`} className="match-picker-mode-text">
                  {mode.text}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {value.mode === 'TEAMS' && (
        <fieldset className="match-picker-teams">
          <legend>Equipos</legend>
          {teams.length > 8 && (
            <SearchField
              id={`${uid}-team-search`}
              label="Buscar equipo"
              value={teamQuery}
              onChange={setTeamQuery}
            />
          )}
          <div className="match-picker-team-list">
            {visibleTeams.map((team) => {
              const checked = value.teamIds.includes(team.id);
              return (
                <label key={team.id} className={`match-picker-team${checked ? ' is-checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onChange(toggleTeam(value, team.id, event.target.checked))}
                  />
                  {team.logoUrl ? (
                    <img src={team.logoUrl} alt="" width={20} height={20} loading="lazy" />
                  ) : null}
                  <span>{team.name}</span>
                </label>
              );
            })}
            {visibleTeams.length === 0 && (
              <p className="match-picker-empty">Ningún equipo se llama así.</p>
            )}
          </div>
        </fieldset>
      )}

      {value.mode !== 'ALL' && (
        <div className="match-picker-matches">
          <div className="match-picker-matches-head">
            <h4>
              Partidos{' '}
              <span className="match-picker-count" aria-live="polite">
                {selectedCount} en la liga
              </span>
            </h4>
            {value.mode === 'TEAMS' && (
              <p className="match-picker-hint">Desmarca los que no quieras que cuenten.</p>
            )}
          </div>
          {value.mode === 'PICK' && (
            <SearchField
              id={`${uid}-match-search`}
              label="Buscar por equipo"
              value={matchQuery}
              onChange={setMatchQuery}
            />
          )}
          {value.mode === 'TEAMS' && value.teamIds.length === 0 ? (
            <p className="match-picker-empty">Elige un equipo para ver sus partidos.</p>
          ) : rounds.length === 0 ? (
            <p className="match-picker-empty">
              {matchQuery
                ? 'Ningún partido con ese equipo.'
                : 'Aún no hay partidos en el calendario.'}
            </p>
          ) : (
            <>
              {played.length > 0 && (
                <button
                  type="button"
                  className="match-picker-toggle"
                  aria-expanded={showPlayed}
                  onClick={() => setShowPlayed((prev) => !prev)}
                >
                  {showPlayed
                    ? 'Ocultar las jornadas ya jugadas'
                    : `Ver ${played.length} ${played.length === 1 ? 'jornada ya jugada' : 'jornadas ya jugadas'}`}
                </button>
              )}
              {visible.map((group, index) => {
                const inLeague = group.matches.filter((match) => isSelected(value, match)).length;
                return (
                  <details
                    key={group.round}
                    className="match-picker-round"
                    open={
                      value.mode === 'TEAMS' ||
                      Boolean(matchQuery) ||
                      (!group.closed && index < 2 + (showPlayed ? played.length : 0))
                    }
                  >
                    <summary>
                      <span className="match-picker-round-name">
                        {displayRoundLabel(group.round)}
                      </span>
                      <span className="match-picker-round-count">
                        {inLeague} de {group.matches.length}
                      </span>
                    </summary>
                    <ul>
                      {group.matches.map((match) => (
                        <MatchRow
                          key={match.id}
                          match={match}
                          checked={isSelected(value, match)}
                          onChange={(checked) => onChange(toggleMatch(value, match, checked))}
                        />
                      ))}
                    </ul>
                  </details>
                );
              })}
              {visible.length === 0 && (
                <p className="match-picker-empty">
                  Todas las jornadas de la lista ya se han jugado.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MatchRow({
  match,
  checked,
  onChange,
}: {
  match: SelectableMatch;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const score =
    match.homeScore != null && match.awayScore != null
      ? `${match.homeScore}–${match.awayScore}`
      : null;
  return (
    <li>
      <label className={`match-picker-match${match.locked ? ' is-locked' : ''}`}>
        <input
          type="checkbox"
          checked={checked}
          disabled={match.locked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="match-picker-match-body">
          <span className="match-picker-match-teams">
            {match.home} – {match.away}
            {score && <span className="match-picker-match-score"> {score}</span>}
          </span>
          <span className="match-picker-match-meta">
            {formatMatchDate(match.date)}
            {match.predictions > 0 &&
              ` · ${match.predictions} ${match.predictions === 1 ? 'predicción' : 'predicciones'}`}
          </span>
          {match.locked && (
            <span className="match-picker-match-locked">
              <Lock size={12} aria-hidden="true" /> Ya cerrado con predicciones: se queda
            </span>
          )}
        </span>
      </label>
    </li>
  );
}

function SearchField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="match-picker-search">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search size={16} aria-hidden="true" />
      <input
        id={id}
        type="search"
        className="glass-input"
        placeholder={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
      />
    </div>
  );
}
