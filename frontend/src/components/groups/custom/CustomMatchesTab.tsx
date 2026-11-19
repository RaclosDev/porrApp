import { useState } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { addCustomMatch, deleteCustomMatch, setCustomMatchDate } from '../../../services/api';
import type { CustomTeam } from '../../../services/api';
import type { Group, Match } from '../../../types/api';
import Flag from '../../Flag';
import { getTotalRounds } from '../../../utils/customBracket';
import {
  formatMatchDate,
  groupByPhase,
  isBye,
  isKnockout,
  type SaveAction,
} from './customCompetition';
import SelectMenu from '../../SelectMenu';

/** Alta y borrado de partidos: grupos, rondas del cuadro (con descansos) o jornadas. */
export default function CustomMatchesTab({
  group,
  teams,
  matches,
  save,
}: {
  group: Group;
  teams: CustomTeam[];
  matches: Match[];
  save: SaveAction;
}) {
  const matchDay = group.poolFormat === 'MATCH_DAY';
  const withGroups = group.poolFormat === 'FULL_BRACKET';
  const [phase, setPhase] = useState<'group' | 'bracket'>(withGroups ? 'group' : 'bracket');
  const [round, setRound] = useState('1');
  const [homeId, setHomeId] = useState('');
  const [awayId, setAwayId] = useState('');
  const [date, setDate] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [editDateTarget, setEditDateTarget] = useState<number | null>(null);
  const [editDate, setEditDate] = useState('');

  const knockout = !matchDay && phase === 'bracket';
  const maxRound = Math.max(
    1,
    getTotalRounds(matches.filter((match) => match.round === 'bracket-1').length),
  );
  const home = teams.find((team) => String(team.id) === homeId);
  // En grupos solo se enfrentan equipos del mismo grupo.
  const awayOptions = teams.filter(
    (team) =>
      String(team.id) !== homeId &&
      (!withGroups || knockout || !home || team.groupName === home.groupName),
  );

  const changeHome = (value: string) => {
    setHomeId(value);
    const next = teams.find((team) => String(team.id) === value);
    const away = teams.find((team) => String(team.id) === awayId);
    if (
      away &&
      (away.id === next?.id || (withGroups && !knockout && away.groupName !== next?.groupName))
    )
      setAwayId('');
  };

  return (
    <>
      <section className="league-admin-card">
        <div className="league-admin-card-head">
          <h3>
            <Plus size={14} aria-hidden="true" />
            Añadir partido
          </h3>
        </div>
        <p className="league-admin-muted">
          {matchDay
            ? 'Cada partido necesita fecha y hora; se agrupan por jornadas según la fecha.'
            : !knockout
              ? 'Cada partido de grupos enfrenta a dos equipos del mismo grupo y necesita fecha y hora.'
              : 'Crea los cruces del cuadro en el orden en que deben aparecer. Elige «Descanso» como visitante si un equipo pasa directo. La primera ronda no se puede tocar tras la primera predicción; sus fechas sí.'}
        </p>
        {teams.length < 2 ? (
          <div className="league-admin-empty">
            <CalendarClock size={20} aria-hidden="true" />
            <strong>Primero añade equipos</strong>
            <span>Hacen falta al menos dos para crear un partido.</span>
          </div>
        ) : (
          <form
            className="custom-admin-form"
            onSubmit={(event) => {
              event.preventDefault();
              void save(
                () =>
                  addCustomMatch(
                    group.id,
                    Number(homeId),
                    awayId ? Number(awayId) : null,
                    date || null,
                    matchDay ? undefined : knockout ? `bracket-${round}` : 'group',
                  ),
                'Partido añadido',
              ).then((ok) => {
                if (!ok) return;
                setHomeId('');
                setAwayId('');
                document.getElementById('custom-admin-match-home')?.focus();
              });
            }}
          >
            {withGroups && (
              <div className="league-admin-field custom-admin-field-short">
                <label htmlFor="custom-admin-match-phase">Fase</label>
                <SelectMenu
                  id="custom-admin-match-phase"
                  className="glass-input"
                  label="Fase"
                  value={phase}
                  onChange={(next) => {
                    setPhase(next as 'group' | 'bracket');
                    setAwayId('');
                  }}
                  items={[
                    { value: 'group', label: 'Grupos' },
                    { value: 'bracket', label: 'Cuadro' },
                  ]}
                />
              </div>
            )}
            {knockout && (
              <div className="league-admin-field custom-admin-field-short">
                <label htmlFor="custom-admin-match-round">Ronda</label>
                <input
                  id="custom-admin-match-round"
                  className="glass-input"
                  type="number"
                  min="1"
                  max={maxRound}
                  step="1"
                  required
                  value={round}
                  onChange={(event) => setRound(event.target.value)}
                />
              </div>
            )}
            <div className="league-admin-field">
              <label htmlFor="custom-admin-match-home">Local</label>
              <SelectMenu
                id="custom-admin-match-home"
                className="glass-input"
                label="Local"
                required
                value={homeId}
                onChange={changeHome}
                items={[
                  { value: '', label: 'Elige equipo' },
                  ...teams.map((team) => ({
                    value: String(team.id),
                    label: `${team.name}${withGroups && !knockout && team.groupName ? ` (${team.groupName})` : ''}`,
                  })),
                ]}
              />
            </div>
            <div className="league-admin-field">
              <label htmlFor="custom-admin-match-away">Visitante</label>
              <SelectMenu
                id="custom-admin-match-away"
                className="glass-input"
                label="Visitante"
                required={!knockout}
                value={awayId}
                onChange={setAwayId}
                items={[
                  { value: '', label: knockout ? 'Descanso (pasa directo)' : 'Elige equipo' },
                  ...awayOptions.map((team) => ({ value: String(team.id), label: team.name })),
                ]}
              />
            </div>
            <div className="league-admin-field">
              <label htmlFor="custom-admin-match-date">
                Fecha y hora{knockout ? ' (opcional)' : ''}
              </label>
              <input
                id="custom-admin-match-date"
                className="glass-input"
                type="datetime-local"
                required={!knockout}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <button type="submit" className="league-admin-btn is-primary">
              <Plus size={15} aria-hidden="true" />
              Añadir partido
            </button>
          </form>
        )}
      </section>

      {matches.length === 0 ? (
        <div className="league-admin-empty">
          <CalendarClock size={20} aria-hidden="true" />
          <strong>Aún no hay partidos</strong>
          <span>Los que crees aparecerán aquí ordenados por fase.</span>
        </div>
      ) : (
        groupByPhase(matches).map((section) => (
          <section key={section.label} className="league-admin-card">
            <div className="league-admin-card-head">
              <h3>{section.label}</h3>
              <span className="league-admin-card-meta">{section.matches.length}</span>
            </div>
            <ul className="league-admin-member-list custom-admin-list">
              {section.matches.map((match) => (
                <li
                  key={match.id}
                  className={`league-admin-member ${deleteTarget === match.id ? 'is-confirming' : ''}`}
                >
                  <div className="league-admin-member-main">
                    <div className="league-admin-member-info">
                      <div className="league-admin-member-name custom-admin-fixture">
                        <Flag team={match.home} logo={match.homeTeamLogo ?? match.homeLogo} />
                        <span>{match.home}</span>
                        <span className="text-muted">–</span>
                        {isBye(match) ? (
                          <span className="league-admin-badge is-you">Descanso</span>
                        ) : (
                          <>
                            <Flag team={match.away} logo={match.awayTeamLogo ?? match.awayLogo} />
                            <span>{match.away}</span>
                          </>
                        )}
                      </div>
                      <span className="league-admin-member-status">
                        {formatMatchDate(match.date)}
                        {match.finished ? ` · ${match.homeScore}–${match.awayScore}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="league-admin-member-actions">
                    {editDateTarget === match.id ? (
                      <form
                        className="flex max-w-full flex-wrap items-center justify-end gap-1.5"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void save(
                            () => setCustomMatchDate(group.id, match.id, editDate || null),
                            'Fecha del partido guardada',
                          ).then((ok) => {
                            if (ok) setEditDateTarget(null);
                          });
                        }}
                      >
                        <label className="sr-only" htmlFor={`custom-admin-date-${match.id}`}>
                          Fecha de {match.home} – {match.away}
                        </label>
                        <input
                          id={`custom-admin-date-${match.id}`}
                          className="glass-input w-46 min-w-0"
                          type="datetime-local"
                          required={!isKnockout(match)}
                          value={editDate}
                          onChange={(event) => setEditDate(event.target.value)}
                        />
                        <button type="submit" className="league-admin-mini-btn">
                          Guardar
                        </button>
                        <button
                          type="button"
                          className="league-admin-mini-btn"
                          onClick={() => setEditDateTarget(null)}
                        >
                          Cancelar
                        </button>
                      </form>
                    ) : deleteTarget === match.id ? (
                      <span className="league-admin-inline-confirm">
                        <span>¿Eliminar?</span>
                        <button
                          type="button"
                          className="league-admin-mini-btn is-danger"
                          onClick={() =>
                            void save(
                              () => deleteCustomMatch(group.id, match.id),
                              'Partido eliminado',
                            ).then(() => setDeleteTarget(null))
                          }
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          className="league-admin-mini-btn"
                          onClick={() => setDeleteTarget(null)}
                          autoFocus
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <>
                        {!match.finished && !isBye(match) && (
                          <button
                            type="button"
                            className="league-admin-icon-btn"
                            aria-label={`Cambiar fecha de ${match.home} – ${match.away}`}
                            title="Cambiar fecha"
                            onClick={() => {
                              setEditDateTarget(match.id);
                              setEditDate(match.date?.slice(0, 16) ?? '');
                            }}
                          >
                            <CalendarClock size={16} aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          className="league-admin-icon-btn is-danger"
                          aria-label={`Eliminar el partido ${match.home} – ${isBye(match) ? 'descanso' : match.away}`}
                          title="Eliminar partido"
                          onClick={() => setDeleteTarget(match.id)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
