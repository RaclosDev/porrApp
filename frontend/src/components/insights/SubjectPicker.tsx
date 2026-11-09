import { useId, type ReactNode } from 'react';

export interface PickerOption {
  value: string;
  label: string;
}

interface SubjectPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Opciones por grupo (grupo del torneo, escudería…); `label` es null si van sueltas. */
  groups: { label: string | null; options: PickerOption[] }[];
  /** Atajos: los favoritos de la liga. */
  shortcuts: PickerOption[];
  /** Bandera, escudo o color que acompaña a cada nombre. */
  icon: (value: string) => ReactNode;
  /** Opción vacía del desplegable: «Elige un equipo». */
  placeholder: string;
}

const option = ({ value, label }: PickerOption) => (
  <option key={value} value={value}>
    {label}
  </option>
);

/**
 * Elección del equipo, jugador o piloto que se busca. Es un select nativo para que en el móvil
 * salga el selector del sistema, con atajos para los favoritos de la liga.
 */
export default function SubjectPicker({
  value,
  onChange,
  groups,
  shortcuts,
  icon,
  placeholder,
}: SubjectPickerProps) {
  const selectId = useId();
  const shortcutsId = useId();
  return (
    <div className="rounded-[14px] border border-line bg-panel p-3.5 sm:p-4.5">
      <label htmlFor={selectId} className="mb-1.5 block text-[0.9rem] font-bold text-main">
        ¿Quién de la liga pone a…?
      </label>
      <div className="flex items-center gap-2.5">
        <span className="flex w-6 shrink-0 justify-center" aria-hidden="true">
          {value && icon(value)}
        </span>
        <select
          id={selectId}
          className="glass-input min-w-0 flex-1 text-[1rem]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{placeholder}</option>
          {groups.map(({ label, options }) =>
            label ? (
              <optgroup key={label} label={label}>
                {options.map(option)}
              </optgroup>
            ) : (
              options.map(option)
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
            {shortcuts.map((shortcut) => (
              <button
                key={shortcut.value}
                type="button"
                aria-pressed={shortcut.value === value}
                onClick={() => onChange(shortcut.value)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-[0.88rem] font-semibold ${shortcut.value === value ? 'border-cyan bg-[rgba(11,95,116,0.15)] text-cyan' : 'border-line bg-[rgba(17,24,39,0.04)] text-main'}`}
              >
                {icon(shortcut.value)}
                {shortcut.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
