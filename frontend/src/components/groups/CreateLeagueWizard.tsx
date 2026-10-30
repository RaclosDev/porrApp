import type { GroupsDashboardState } from '../../hooks/useGroupsDashboard';
import { POOL_FORMATS } from '../../hooks/useGroupsDashboard';
import type { PoolFormat } from '../../types/api';

interface CreateLeagueWizardProps {
  competitions: GroupsDashboardState['competitions'];
  newGroupName: GroupsDashboardState['newGroupName'];
  setNewGroupName: GroupsDashboardState['setNewGroupName'];
  selectedCompetition: GroupsDashboardState['selectedCompetition'];
  setSelectedCompetition: GroupsDashboardState['setSelectedCompetition'];
  selectedPoolFormat: GroupsDashboardState['selectedPoolFormat'];
  setSelectedPoolFormat: GroupsDashboardState['setSelectedPoolFormat'];
  includePichichi: GroupsDashboardState['includePichichi'];
  setIncludePichichi: GroupsDashboardState['setIncludePichichi'];
  isCreating: GroupsDashboardState['isCreating'];
  handleCreate: GroupsDashboardState['handleCreate'];
  setShowCreateModal: (show: boolean) => void;
}

/** Asistente para crear una liga a partir de una plantilla. */
export default function CreateLeagueWizard({
  competitions,
  newGroupName,
  setNewGroupName,
  selectedCompetition,
  setSelectedCompetition,
  selectedPoolFormat,
  setSelectedPoolFormat,
  includePichichi,
  setIncludePichichi,
  isCreating,
  handleCreate,
  setShowCreateModal,
}: CreateLeagueWizardProps) {
  return (
    <div
      style={{
        maxWidth: '820px',
        margin: '0 auto 30px auto',
      }}
    >
      <div
        className="glass-panel"
        style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          border: '1px solid #00d2d3',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3
            style={{
              margin: 0,
              color: 'var(--accent-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            🏆 Crear Nueva Liga
          </h3>
          <button
            type="button"
            onClick={() => setShowCreateModal(false)}
            aria-label="Cerrar modal"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '1.2rem',
              minWidth: '40px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleCreate}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: '4px',
              }}
            >
              Nombre de tu Liga:
            </label>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Ej: Amigos del Barrio, Porra Oficina 2026..."
              aria-label="Nombre del nuevo grupo"
              className="glass-input"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                }}
              >
                Competición Deportiva:
              </label>
              <select
                aria-label="Seleccionar competición deportiva"
                value={selectedCompetition}
                onChange={(e) => setSelectedCompetition(e.target.value)}
                className="glass-input"
                style={{ width: '100%' }}
              >
                {competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1 1 200px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                }}
              >
                Modalidad / Formato:
              </label>
              <select
                aria-label="Seleccionar formato de porra"
                value={selectedPoolFormat}
                onChange={(e) => setSelectedPoolFormat(e.target.value as PoolFormat)}
                className="glass-input"
                style={{ width: '100%' }}
              >
                {POOL_FORMATS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              padding: '8px 12px',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
            }}
          >
            <input
              type="checkbox"
              checked={includePichichi}
              onChange={(e) => setIncludePichichi(e.target.checked)}
            />
            <span>Incluir Porra de Máximo Goleador (Pichichi)</span>
          </label>

          <button
            type="submit"
            disabled={isCreating}
            className="glass-btn primary-btn"
            style={{
              padding: '12px',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              marginTop: '6px',
              cursor: isCreating ? 'not-allowed' : 'pointer',
            }}
          >
            {isCreating ? '⏳ Creando Liga...' : '🚀 Crear Liga'}
          </button>
        </form>
      </div>
    </div>
  );
}
