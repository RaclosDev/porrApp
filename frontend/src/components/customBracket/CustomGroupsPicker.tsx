import Flag from '../Flag';
import CustomSelect from '../CustomSelect';

interface CustomGroupsPickerProps {
  teamsByGroup: Record<string, string[]>;
  /** Orden elegido de cada grupo (puesto -> equipo). */
  groups: Record<string, string[]>;
  logos: Record<string, string | null>;
  /** Si se puede cambiar un grupo (pronóstico abierto y grupo sin cerrar). */
  canEdit: (group: string) => boolean;
  onSelect: (group: string, position: number, name: string) => void;
}

/** Fase de grupos de un cuadro propio: el puesto de cada equipo en su grupo. */
export default function CustomGroupsPicker({
  teamsByGroup,
  groups,
  logos,
  canEdit,
  onSelect,
}: CustomGroupsPickerProps) {
  return (
    <div className="w-full mb-7.5">
      <div className="text-center mb-7.5">
        <h2 className="poster-title text-accent-text m-0">Fase de grupos</h2>
      </div>
      <div className="groups-grid">
        {Object.entries(teamsByGroup).map(([group, members], groupIndex) => (
          <div
            key={group}
            className="group-card paper-panel album-sheet relative flex flex-col gap-2"
            style={{ zIndex: 50 - groupIndex }}
          >
            <h3 className="mt-0 mb-[5px] mx-0 text-center border-b border-b-line pb-1.5 text-[1.1rem]">
              Grupo {group}
            </h3>
            <div className="grid grid-cols-[1fr_1fr] gap-1.5 mb-3">
              {members.map((name) => (
                <div
                  className="flex items-center justify-center gap-1.5 text-[0.85rem] bg-panel bg-none p-1.5 rounded-[4px] overflow-hidden"
                  key={name}
                >
                  <Flag team={name} logo={logos[name]} style={{ width: 16, height: 16 }} />
                  <span
                    className="whitespace-nowrap overflow-hidden text-ellipsis font-medium"
                    title={name}
                  >
                    {name}
                  </span>
                </div>
              ))}
            </div>
            {members.map((_, position) => (
              <div className="flex flex-col gap-1" key={position}>
                <span className="text-[0.8rem] text-accent-text font-bold">
                  {position + 1}.º clasificado
                </span>
                {canEdit(group) ? (
                  <CustomSelect
                    value={groups[group]?.[position] ?? ''}
                    onChange={(value) => onSelect(group, position, value)}
                    label={`Grupo ${group}, ${position + 1}.º clasificado`}
                    placeholder="Elige equipo"
                    options={[
                      { value: '', label: 'Elige equipo' },
                      ...members.map((name) => ({ value: name, label: name })),
                    ]}
                  />
                ) : (
                  <span className="glass-input">{groups[group]?.[position] || 'Sin elegir'}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
