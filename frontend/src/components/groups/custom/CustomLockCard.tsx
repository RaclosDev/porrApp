import { useEffect, useRef, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { setCustomLockConfig, type CustomLockMode } from '../../../services/api';
import { queryKeys } from '../../../services/queryKeys';
import { useCustomLock } from '../../../hooks/useCustomLock';
import type { Group } from '../../../types/api';
import { isMatchBasedFormat } from '../../../utils/poolFormat';
import { formatMatchDate, type SaveAction } from './customCompetition';
import {
  BRACKET_LOCK_MODES,
  DRAWN_KNOCKOUT_LOCK_MODES,
  LOCK_UNIT_MINUTES,
  MATCHDAY_LOCK_MODES,
  MAX_LOCK_OFFSET_MINUTES,
  SINGLE_LOCK_MODES,
  describeLockOffset,
  splitLockOffset,
  type LockUnit,
} from './lockModes';

function describe(
  mode: CustomLockMode,
  offsetMinutes: number,
  matchday: boolean,
  knockoutDraw = false,
): string {
  if (mode === 'FIXED_DATE') return 'Fecha fija';
  const margin = offsetMinutes ? ` · ${describeLockOffset(offsetMinutes)}` : '';
  const modes = matchday
    ? MATCHDAY_LOCK_MODES
    : knockoutDraw
      ? DRAWN_KNOCKOUT_LOCK_MODES
      : BRACKET_LOCK_MODES;
  return `${modes.find((item) => item.value === mode)?.label ?? mode}${margin}`;
}

/**
 * Cómo y cuándo se cierran los pronósticos de una liga. En una de cuadro, el cierre por rondas o por
 * partidos solo existe cuando se pronostica cruce a cruce (personalizado o torneo con cuadro propio);
 * en una por jornadas se cierra cada partido, cada día o cada jornada.
 */
export default function CustomLockCard({
  group,
  save,
  onLockDateSaved,
  allowProgressive = true,
}: {
  group: Group;
  save: SaveAction;
  onLockDateSaved?: (lockDate: string) => void;
  allowProgressive?: boolean;
}) {
  const queryClient = useQueryClient();
  // Superviviente también se pronostica partido a partido.
  const matchday = isMatchBasedFormat(group.poolFormat);
  const lock = useCustomLock(group.id.toString());
  const current = lock.state;
  const [mode, setMode] = useState<CustomLockMode>('FIXED_DATE');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState(0);
  const [unit, setUnit] = useState<LockUnit>('hours');

  // Se rellena una sola vez: el estado se vuelve a pedir cada minuto y no debe pisar lo que se edita.
  const loaded = useRef(false);
  useEffect(() => {
    if (!current || loaded.current) return;
    loaded.current = true;
    setMode(current.mode);
    setDate(current.mode === 'FIXED_DATE' ? (current.lockDate?.slice(0, 16) ?? '') : '');
    const offset = splitLockOffset(current.offsetMinutes);
    setAmount(offset.amount);
    setUnit(offset.amount ? offset.unit : 'hours');
  }, [current]);

  const offsetMinutes = Math.max(0, Math.round(amount)) * LOCK_UNIT_MINUTES[unit];
  let modes = BRACKET_LOCK_MODES;
  if (matchday) modes = MATCHDAY_LOCK_MODES;
  else if (group.knockoutDraw) modes = DRAWN_KNOCKOUT_LOCK_MODES;
  else if (!allowProgressive) {
    modes = SINGLE_LOCK_MODES;
  }
  const selected = modes.find((item) => item.value === mode) ?? modes[0];

  let status = 'Sin fijar';
  if (current && matchday) {
    status = describe(current.mode, current.offsetMinutes, true);
  } else if (current && lock.configured) {
    status = describe(current.mode, current.offsetMinutes, false, group.knockoutDraw);
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
          Cierre de predicciones
        </h3>
        <span className="league-admin-card-meta">{status}</span>
      </div>
      {current?.nextLockAt &&
        !current.fullyLocked &&
        current.mode !== 'FIXED_DATE' &&
        !matchday && (
          <p className="league-admin-muted">
            Próximo cierre: {formatMatchDate(current.nextLockAt)}.
          </p>
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
              onLockDateSaved?.(state.lockDate ?? '');
            }, 'Cierre de predicciones guardado');
          }}
        >
          <fieldset className="league-admin-field custom-lock-modes">
            <legend>Cuándo se cierran</legend>
            {modes.map((item) => (
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
              <label htmlFor="custom-admin-lock-offset">
                {mode === 'PER_MATCH'
                  ? 'Margen antes del partido'
                  : 'Margen antes del primer partido'}
              </label>
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
                  onChange={(event) => setUnit(event.target.value as LockUnit)}
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
            disabled={(mode === 'FIXED_DATE' && !date) || offsetMinutes > MAX_LOCK_OFFSET_MINUTES}
          >
            Guardar cierre
          </button>
        </form>
      )}
      <p className="league-admin-muted">
        Puedes cambiar el criterio aunque ya haya predicciones. Si el nuevo cierre es posterior, lo
        que ya estaba cerrado vuelve a abrirse.
        {lock.progressive &&
          !matchday &&
          ' Quien no haya enviado su predicción antes del primer cierre ya no podrá entrar, y de los demás solo se ve lo que ya está cerrado.'}
      </p>
    </section>
  );
}
