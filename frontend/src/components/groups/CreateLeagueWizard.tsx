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
    <div className="max-w-205 mt-0 mb-7.5 mx-auto">
      <div className="glass-panel p-6 flex flex-col gap-4 border border-[#00d2d3]">
        <div className="flex justify-between items-center">
          <h3 className="m-0 text-accent flex items-center gap-2.5">🏆 Crear Nueva Liga</h3>
          <button
            className="bg-none border-none text-muted cursor-pointer text-[1.2rem] min-w-10 min-h-10 flex items-center justify-center"
            type="button"
            onClick={() => setShowCreateModal(false)}
            aria-label="Cerrar modal"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        <form className="flex flex-col gap-3.5" onSubmit={handleCreate}>
          <div>
            <label className="block text-[0.8rem] text-muted mb-1">Nombre de tu Liga:</label>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Ej: Amigos del Barrio, Porra Oficina 2026..."
              aria-label="Nombre del nuevo grupo"
              className="glass-input w-full"
            />
          </div>

          <div className="flex gap-2.5 flex-wrap">
            <div className="flex-[1_1_200px]">
              <label className="block text-[0.8rem] text-muted mb-1">Competición Deportiva:</label>
              <select
                aria-label="Seleccionar competición deportiva"
                value={selectedCompetition}
                onChange={(e) => setSelectedCompetition(e.target.value)}
                className="glass-input w-full"
              >
                {competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-[1_1_200px]">
              <label className="block text-[0.8rem] text-muted mb-1">Modalidad / Formato:</label>
              <select
                aria-label="Seleccionar formato de porra"
                value={selectedPoolFormat}
                onChange={(e) => setSelectedPoolFormat(e.target.value as PoolFormat)}
                className="glass-input w-full"
              >
                {POOL_FORMATS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-muted text-[0.85rem] cursor-pointer py-2 px-3 bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-[8px]">
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
            className={`glass-btn primary-btn p-3 font-bold text-[0.95rem] mt-1.5 ${isCreating ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {isCreating ? '⏳ Creando Liga...' : '🚀 Crear Liga'}
          </button>
        </form>
      </div>
    </div>
  );
}
