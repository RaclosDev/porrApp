import { useState } from 'react';
import { Image, Plus, Shield, Trash2 } from 'lucide-react';
import { addCustomTeam, deleteCustomTeam, setCustomTeamLogo } from '../../../services/api';
import type { CustomTeam } from '../../../services/api';
import type { Group } from '../../../types/api';
import Flag from '../../Flag';
import type { SaveAction } from './customCompetition';

/** Alta de equipos (con grupo y escudo), cambio de escudo y borrado. */
export default function CustomTeamsTab({
  group,
  teams,
  save,
}: {
  group: Group;
  teams: CustomTeam[];
  save: SaveAction;
}) {
  const withGroups = group.poolFormat === 'FULL_BRACKET';
  const [name, setName] = useState('');
  const [teamGroup, setTeamGroup] = useState('');
  const [logo, setLogo] = useState('');
  const [editingLogo, setEditingLogo] = useState<number | null>(null);
  const [logoDraft, setLogoDraft] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const sections = withGroups
    ? [...new Set(teams.map((team) => team.groupName ?? ''))]
        .sort((a, b) => a.localeCompare(b))
        .map((label) => ({
          label: label ? `Grupo ${label}` : 'Sin grupo',
          teams: teams.filter((team) => (team.groupName ?? '') === label),
        }))
    : [{ label: '', teams }];

  return (
    <>
      <section className="league-admin-card">
        <div className="league-admin-card-head">
          <h3>
            <Plus size={14} aria-hidden="true" />
            Añadir equipo
          </h3>
        </div>
        <form
          className="custom-admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save(
              () =>
                addCustomTeam(
                  group.id,
                  name.trim(),
                  withGroups ? teamGroup.trim() : undefined,
                  logo.trim() || undefined,
                ),
              `${name.trim()} añadido`,
            ).then((ok) => {
              if (!ok) return;
              setName('');
              setLogo('');
              document.getElementById('custom-admin-team-name')?.focus();
            });
          }}
        >
          <div className="league-admin-field">
            <label htmlFor="custom-admin-team-name">Nombre</label>
            <input
              id="custom-admin-team-name"
              className="glass-input"
              required
              maxLength={100}
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre del equipo"
            />
          </div>
          {withGroups && (
            <div className="league-admin-field custom-admin-field-short">
              <label htmlFor="custom-admin-team-group">Grupo</label>
              <input
                id="custom-admin-team-group"
                className="glass-input"
                required
                maxLength={50}
                autoComplete="off"
                value={teamGroup}
                onChange={(event) => setTeamGroup(event.target.value)}
                placeholder="Ej.: A"
              />
            </div>
          )}
          <div className="league-admin-field">
            <label htmlFor="custom-admin-team-logo">Escudo (opcional)</label>
            <input
              id="custom-admin-team-logo"
              className="glass-input"
              type="url"
              pattern="https://.*"
              maxLength={500}
              value={logo}
              onChange={(event) => setLogo(event.target.value)}
              placeholder="https://…/escudo.png"
            />
          </div>
          <button type="submit" className="league-admin-btn is-primary">
            <Plus size={15} aria-hidden="true" />
            Añadir equipo
          </button>
        </form>
        {withGroups && (
          <p className="league-admin-hint">
            El grupo se mantiene entre altas para que añadas varios equipos seguidos.
          </p>
        )}
      </section>

      <section className="league-admin-card">
        <div className="league-admin-card-head">
          <h3>
            <Shield size={14} aria-hidden="true" />
            Equipos
          </h3>
          <span className="league-admin-card-meta">{teams.length}</span>
        </div>
        {teams.length === 0 ? (
          <div className="league-admin-empty">
            <Shield size={20} aria-hidden="true" />
            <strong>Aún no hay equipos</strong>
            <span>Añade al menos dos para poder crear partidos.</span>
          </div>
        ) : (
          sections.map((section) => (
            <div key={section.label} className="custom-admin-group">
              {section.label && <h4 className="custom-admin-group-title">{section.label}</h4>}
              <ul className="league-admin-member-list custom-admin-list">
                {section.teams.map((team) => (
                  <li
                    key={team.id}
                    className={`league-admin-member ${deleteTarget === team.id ? 'is-confirming' : ''}`}
                  >
                    <div className="league-admin-member-main">
                      <span className="custom-admin-crest">
                        {team.logoUrl ? (
                          <Flag team={team.name} logo={team.logoUrl} />
                        ) : (
                          <Shield size={18} aria-hidden="true" />
                        )}
                      </span>
                      <div className="league-admin-member-info">
                        <div className="league-admin-member-name">
                          <span>{team.name}</span>
                        </div>
                        <span className="league-admin-member-status">
                          {team.logoUrl ? 'Con escudo' : 'Sin escudo'}
                        </span>
                      </div>
                    </div>
                    <div className="league-admin-member-actions">
                      {deleteTarget === team.id ? (
                        <span className="league-admin-inline-confirm">
                          <span>¿Eliminar?</span>
                          <button
                            type="button"
                            className="league-admin-mini-btn is-danger"
                            onClick={() =>
                              void save(
                                () => deleteCustomTeam(group.id, team.id),
                                `${team.name} eliminado`,
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
                          <button
                            type="button"
                            className="league-admin-icon-btn"
                            aria-expanded={editingLogo === team.id}
                            aria-controls={`custom-admin-logo-${team.id}`}
                            aria-label={`Cambiar el escudo de ${team.name}`}
                            title="Cambiar escudo"
                            onClick={() => {
                              setEditingLogo(editingLogo === team.id ? null : team.id);
                              setLogoDraft(team.logoUrl ?? '');
                            }}
                          >
                            <Image size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="league-admin-icon-btn is-danger"
                            aria-label={`Eliminar equipo ${team.name}`}
                            title="Eliminar equipo"
                            onClick={() => setDeleteTarget(team.id)}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                    {editingLogo === team.id && (
                      <form
                        id={`custom-admin-logo-${team.id}`}
                        className="custom-admin-form custom-admin-row-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void save(
                            () => setCustomTeamLogo(group.id, team.id, logoDraft.trim() || null),
                            logoDraft.trim() ? 'Escudo actualizado' : 'Escudo quitado',
                          ).then((ok) => ok && setEditingLogo(null));
                        }}
                      >
                        <div className="league-admin-field">
                          <label htmlFor={`custom-admin-logo-input-${team.id}`}>
                            Dirección del escudo de {team.name}
                          </label>
                          <input
                            id={`custom-admin-logo-input-${team.id}`}
                            className="glass-input"
                            type="url"
                            pattern="https://.*"
                            maxLength={500}
                            autoFocus
                            value={logoDraft}
                            onChange={(event) => setLogoDraft(event.target.value)}
                            placeholder="https://…/escudo.png (vacío para quitarlo)"
                          />
                        </div>
                        <button type="submit" className="league-admin-btn is-primary">
                          Guardar escudo
                        </button>
                        <button
                          type="button"
                          className="league-admin-btn is-ghost"
                          onClick={() => setEditingLogo(null)}
                        >
                          Cancelar
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </>
  );
}
