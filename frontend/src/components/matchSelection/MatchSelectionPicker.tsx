import { useId, useMemo, useState } from 'react';
import { Lock, Search } from 'lucide-react';
import type { SelectableMatch, SelectableTeam } from '../../types/api';
import { displayRoundLabel, formatMatchDate } from '../../utils/matchday';
import {
  MAX_COMPETITIONS,
  PICK_MODES,
  groupByRound,
  isMultiCompetition,
  isSelected,
  matchesQuery,
  switchMode,
  teamsQuery,
  toggleCompetition,
  toggleMatch,
  toggleTeam,
  type PickMode,
  type SelectionValue,
} from './matchSelection';

/** Competición que se puede juntar en la liga. */
interface CompetitionOption {
  id: number;
  name: string;
  /** Tiene partidos cerrados con predicciones en la liga: no se puede quitar. */
  locked?: boolean;
}

interface Props {
  teams: SelectableTeam[];
  matches: SelectableMatch[];
  value: SelectionValue;
  onChange: (value: SelectionValue) => void;
  /**
   * Competición de la liga y las demás que se pueden juntar con ella. Sin ellas no se ofrece juntar
   * partidos de varias competiciones.
   */
  primaryCompetition?: CompetitionOption;
  otherCompetitions?: CompetitionOption[];
  /** El calendario de las competiciones elegidas aún se está cargando. */
  loadingCalendar?: boolean;
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
  primaryCompetition,
  otherCompetitions,
  loadingCalendar = false,
  errorId,
  fieldId,
}: Props) {
  const uid = useId();
  const [teamQuery, setTeamQuery] = useState('');
  const [matchQuery, setMatchQuery] = useState('');
  const [showPlayed, setShowPlayed] = useState(false);
  const [competitionFilter, setCompetitionFilter] = useState<number | null>(null);
  const multi = isMultiCompetition(value);

  // Nombre de cada competición, para etiquetar los partidos cuando la liga junta varias.
  const competitionNames = useMemo(() => {
    const names = new Map<number, string>();
    if (primaryCompetition) names.set(primaryCompetition.id, primaryCompetition.name);
    otherCompetitions?.forEach((item) => names.set(item.id, item.name));
    return names;
  }, [primaryCompetition, otherCompetitions]);
  const leagueCompetitions = multi
    ? value.competitionIds.filter((id) => competitionNames.has(id))
    : [];
  const activeFilter =
    competitionFilter != null && value.competitionIds.includes(competitionFilter)
      ? competitionFilter
      : null;

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
    return base.filter(
      (match) =>
        matchesQuery(match, matchQuery) &&
        (activeFilter == null || match.competitionId === activeFilter),
    );
  }, [matches, value, matchQuery, activeFilter]);
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
          // Con varias competiciones no caben todos sus partidos: serían demasiados por semana.
          const unavailable = mode.value === 'ALL' && multi;
          return (
            <label
              key={mode.value}
              htmlFor={id}
              className={`match-picker-mode${value.mode === mode.value ? ' is-checked' : ''}${unavailable ? ' is-disabled' : ''}`}
            >
              <input
                id={id}
                type="radio"
                name={`${uid}-mode`}
                value={mode.value}
                checked={value.mode === mode.value}
                disabled={unavailable}
                onChange={() => changeMode(mode.value)}
                aria-describedby={`${id}-text`}
              />
              <span>
                <span className="match-picker-mode-title">{mode.title}</span>
                <span id={`${id}-text`} className="match-picker-mode-text">
                  {unavailable ? 'Solo con una competición.' : mode.text}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {primaryCompetition && otherCompetitions && otherCompetitions.length > 0 && (
        <details className="match-picker-competitions" open={multi || undefined}>
          <summary>
            <span>Añadir otras competiciones</span>
            {multi && (
              <span className="match-picker-count">
                {value.competitionIds.length} competiciones
              </span>
            )}
          </summary>
          <fieldset>
            <legend className="sr-only">Competiciones de la liga</legend>
            <p className="match-picker-hint">
              Las jornadas pasan a ser semanas, de lunes a domingo.
            </p>
            <div className="match-picker-team-list">
              <label className="match-picker-team is-checked">
                <input type="checkbox" checked disabled />
                <span>{primaryCompetition.name}</span>
              </label>
              {otherCompetitions.map((competition) => {
                const checked = value.competitionIds.includes(competition.id);
                const full =
                  !checked && Math.max(1, value.competitionIds.length) >= MAX_COMPETITIONS;
                const locked = checked && Boolean(competition.locked);
                return (
                  <label
                    key={competition.id}
                    className={`match-picker-team${checked ? ' is-checked' : ''}`}
                    title={locked ? 'Tiene partidos cerrados con predicciones' : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked || full}
                      onChange={(event) =>
                        onChange(
                          toggleCompetition(
                            value,
                            primaryCompetition.id,
                            competition.id,
                            event.target.checked,
                            matches,
                          ),
                        )
                      }
                    />
                    {locked && <Lock size={12} aria-hidden="true" />}
                    <span>{competition.name}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </details>
      )}

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
          {leagueCompetitions.length > 1 && (
            <div className="match-picker-filter" role="group" aria-label="Ver partidos de">
              {[null, ...leagueCompetitions].map((id) => (
                <button
                  key={id ?? 'all'}
                  type="button"
                  aria-pressed={activeFilter === id}
                  onClick={() => setCompetitionFilter(id)}
                >
                  {id == null ? 'Todas' : competitionNames.get(id)}
                </button>
              ))}
            </div>
          )}
          {loadingCalendar && (
            <p className="match-picker-hint" aria-live="polite">
              Cargando el calendario…
            </p>
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
                          competition={
                            multi && match.competitionId != null
                              ? competitionNames.get(match.competitionId)
                              : undefined
                          }
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
  competition,
  checked,
  onChange,
}: {
  match: SelectableMatch;
  /** Competición del partido, si la liga junta varias. */
  competition?: string;
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
            {competition && `${competition} · `}
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
