import { useId } from 'react';
import { TeamFlag } from './InsightCard';

interface TeamPickerProps {
  value: string;
  onChange: (team: string) => void;
  /** Equipos por grupo; `group` es null si no hay grupos oficiales. */
  groups: { group: string | null; teams: string[] }[];
  /** Atajos: los equipos más elegidos como campeón. */
  shortcuts: string[];
}

/**
 * Elección del equipo. Es un select nativo para que en el móvil salga el selector del sistema,
 * con atajos para los favoritos de la liga.
 */
export default function TeamPicker({ value, onChange, groups, shortcuts }: TeamPickerProps) {
  const selectId = useId();
  const shortcutsId = useId();
  return (
    <div className="rounded-[14px] border border-line bg-panel p-3.5 sm:p-4.5">
      <label htmlFor={selectId} className="mb-1.5 block text-[0.9rem] font-bold text-main">
        ¿Quién de la liga pone a…?
      </label>
      <div className="flex items-center gap-2.5">
        <span className="flex w-6 shrink-0 justify-center" aria-hidden="true">
          {value && <TeamFlag team={value} />}
        </span>
        <select
          id={selectId}
          className="glass-input min-w-0 flex-1 text-[1rem]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Elige un equipo</option>
          {groups.map(({ group, teams }) =>
            group ? (
              <optgroup key={group} label={`Grupo ${group}`}>
                {teams.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </optgroup>
            ) : (
              teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))
            ),
          )}
        </select>
      </div>
      {shortcuts.length > 0 && (
        <div className="mt-3">
          <p id={shortcutsId} className="m-0 mb-1.5 text-[0.8rem] text-muted">
            Favoritos de la liga
          </p>
          <div role="group" aria-labelledby={shortcutsId} className="flex flex-wrap gap-1.5">
            {shortcuts.map((team) => (
              <button
                key={team}
                type="button"
                aria-pressed={team === value}
                onClick={() => onChange(team)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-[0.88rem] font-semibold ${team === value ? 'border-cyan bg-[rgba(0,210,211,0.15)] text-cyan' : 'border-line bg-[rgba(255,255,255,0.04)] text-main'}`}
              >
                <TeamFlag team={team} />
                {team}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
