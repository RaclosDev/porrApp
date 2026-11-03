import { useEffect, useRef, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { setCustomLockConfig, type CustomLockMode } from '../../../services/api';
import { queryKeys } from '../../../services/queryKeys';
import { useCustomLock } from '../../../hooks/useCustomLock';
import type { Group } from '../../../types/api';
import { formatMatchDate, type SaveAction } from './customCompetition';

const MODES: { value: CustomLockMode; label: string; hint: string }[] = [
  {
    value: 'FIXED_DATE',
    label: 'En una fecha fija',
    hint: 'Todos los pronósticos se cierran a la vez en la fecha que elijas.',
  },
  {
    value: 'FIRST_MATCH',
    label: 'Al empezar el primer partido',
    hint: 'Todo se cierra a la vez cuando empieza el primer partido, o antes si pones margen. Sigue al calendario aunque cambies partidos.',
  },
  {
    value: 'PER_ROUND',
    label: 'Por rondas',
    hint: 'Cada grupo y cada ronda del cuadro se cierran al empezar su primer partido. El resto se puede cambiar hasta entonces.',
  },
  {
    value: 'PER_MATCH',
    label: 'Por partidos',
    hint: 'Cada cruce se cierra al empezar ese partido; cada grupo, al empezar su primer partido.',
  },
];

type Unit = 'minutes' | 'hours' | 'days';
const UNIT_MINUTES: Record<Unit, number> = { minutes: 1, hours: 60, days: 1440 };

function splitOffset(minutes: number): { amount: number; unit: Unit } {
  if (minutes > 0 && minutes % 1440 === 0) return { amount: minutes / 1440, unit: 'days' };
  if (minutes > 0 && minutes % 60 === 0) return { amount: minutes / 60, unit: 'hours' };
  return { amount: minutes, unit: 'minutes' };
}

function describe(mode: CustomLockMode, offsetMinutes: number): string {
  if (mode === 'FIXED_DATE') return 'Fecha fija';
  const { amount, unit } = splitOffset(offsetMinutes);
  const unitLabel = {
    minutes: 'min',
    hours: amount === 1 ? 'hora' : 'horas',
    days: amount === 1 ? 'día' : 'días',
  }[unit];
  const margin = offsetMinutes ? ` · ${amount} ${unitLabel} antes` : '';
  return `${MODES.find((item) => item.value === mode)?.label ?? mode}${margin}`;
}

/** Cómo y cuándo se cierran los pronósticos de una competición personalizada. */
export default function CustomLockCard({
  group,
  save,
  onLockDateSaved,
}: {
  group: Group;
  save: SaveAction;
  onLockDateSaved: (lockDate: string) => void;
}) {
  const queryClient = useQueryClient();
  const lock = useCustomLock(group.id.toString());
  const current = lock.state;
  const [mode, setMode] = useState<CustomLockMode>('FIXED_DATE');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState(0);
  const [unit, setUnit] = useState<Unit>('hours');

  // Se rellena una sola vez: el estado se vuelve a pedir cada minuto y no debe pisar lo que se edita.
  const loaded = useRef(false);
  useEffect(() => {
    if (!current || loaded.current) return;
    loaded.current = true;
    setMode(current.mode);
    setDate(current.mode === 'FIXED_DATE' ? (current.lockDate?.slice(0, 16) ?? '') : '');
    const offset = splitOffset(current.offsetMinutes);
    setAmount(offset.amount);
    setUnit(offset.amount ? offset.unit : 'hours');
  }, [current]);

  const offsetMinutes = Math.max(0, Math.round(amount)) * UNIT_MINUTES[unit];
  const selected = MODES.find((item) => item.value === mode)!;

  let status = 'Sin fijar';
  if (current && lock.configured) {
    status = describe(current.mode, current.offsetMinutes);
    if (current.fullyLocked) status += ' · cerrado';
    else if (current.mode === 'FIXED_DATE' || current.mode === 'FIRST_MATCH') {
      status += current.lockDate ? ` · ${formatMatchDate(current.lockDate)}` : '';
    }
  } else if (current?.mode === 'FIRST_MATCH') {
    status = 'Esperando a que algún partido tenga fecha';
  }

  return (
    <section className="league-admin-card">
      <div className="league-admin-card-head">
        <h3>
          <CalendarClock size={14} aria-hidden="true" />
          Cierre de pronósticos
        </h3>
        <span className="league-admin-card-meta">{status}</span>
      </div>
      {current?.nextLockAt && !current.fullyLocked && current.mode !== 'FIXED_DATE' && (
        <p className="league-admin-muted">Próximo cierre: {formatMatchDate(current.nextLockAt)}.</p>
      )}
      {current && (
        <form
          className="custom-admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save(async () => {
              const state = await setCustomLockConfig(group.id, {
                mode,
                offsetMinutes: mode === 'FIXED_DATE' ? 0 : offsetMinutes,
                lockDate: mode === 'FIXED_DATE' ? date : null,
              });
              queryClient.setQueryData(queryKeys.customLockState(group.id.toString()), state);
              await queryClient.invalidateQueries({
                queryKey: queryKeys.group(group.id.toString()),
              });
              await queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() });
              onLockDateSaved(state.lockDate ?? '');
            }, 'Cierre de pronósticos guardado');
          }}
        >
          <fieldset className="league-admin-field custom-lock-modes">
            <legend>Cuándo se cierran</legend>
            {MODES.map((item) => (
              <label key={item.value} className="custom-lock-mode">
                <input
                  type="radio"
                  name="custom-lock-mode"
                  value={item.value}
                  checked={mode === item.value}
                  onChange={() => setMode(item.value)}
                />
                <span>{item.label}</span>
              </label>
            ))}
            <p className="league-admin-muted m-0">{selected.hint}</p>
          </fieldset>

          {mode === 'FIXED_DATE' ? (
            <div className="league-admin-field">
              <label htmlFor="custom-admin-lock-date">Fecha y hora de cierre</label>
              <input
                id="custom-admin-lock-date"
                className="glass-input"
                type="datetime-local"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
          ) : (
            <div className="league-admin-field">
              <label htmlFor="custom-admin-lock-offset">Margen antes del partido</label>
              <div className="flex gap-2">
                <input
                  id="custom-admin-lock-offset"
                  className="glass-input w-24"
                  type="number"
                  min={0}
                  step={1}
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value) || 0)}
                />
                <select
                  className="glass-input"
                  aria-label="Unidad del margen"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value as Unit)}
                >
                  <option value="minutes">minutos</option>
                  <option value="hours">horas</option>
                  <option value="days">días</option>
                </select>
              </div>
              <p className="league-admin-muted m-0">0 = justo cuando empieza. Máximo 30 días.</p>
            </div>
          )}

          <button
            type="submit"
            className="league-admin-btn is-primary"
            disabled={(mode === 'FIXED_DATE' && !date) || offsetMinutes > 30 * 1440}
          >
            Guardar cierre
          </button>
        </form>
      )}
      <p className="league-admin-muted">
        Solo se puede cambiar antes del primer pronóstico.
        {lock.progressive &&
          ' Quien no haya enviado su pronóstico antes del primer cierre ya no podrá entrar, y de los demás solo se ve lo que ya está cerrado.'}
      </p>
    </section>
  );
}
