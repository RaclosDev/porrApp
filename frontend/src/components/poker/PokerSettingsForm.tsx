import { useState, type FormEvent } from 'react';
import type { BlindLevel, PokerExtra, PokerSettings } from '../../services/endpoints/poker';
import PokerPrizeShares, { sharesTotal } from './PokerPrizeShares';
import { chips } from './pokerFormat';

interface Props {
  date: string;
  settings: PokerSettings;
  editing: boolean;
  busy: boolean;
  onCancel: () => void;
  onSave: (date: string, settings: PokerSettings) => Promise<boolean>;
}

export default function PokerSettingsForm({
  date,
  settings,
  editing,
  busy,
  onCancel,
  onSave,
}: Props) {
  const [day, setDay] = useState(date);
  const [draft, setDraft] = useState(settings);
  const [anteEnabled, setAnteEnabled] = useState(settings.levels.some((level) => level.ante > 0));
  const [error, setError] = useState('');
  const patch = (changes: Partial<PokerSettings>) =>
    setDraft((previous) => ({ ...previous, ...changes }));
  const updateLevel = (index: number, changes: Partial<BlindLevel>) =>
    patch({
      levels: draft.levels.map((level, i) => (i === index ? { ...level, ...changes } : level)),
    });
  const appendLevel = (breakLevel: boolean) => {
    const previous = [...draft.levels].reverse().find((level) => level.big > 0);
    patch({
      levels: [
        ...draft.levels,
        breakLevel
          ? { small: 0, big: 0, ante: 0, minutes: 10 }
          : {
              small: previous?.small ?? 25,
              big: previous?.big ?? 50,
              ante: anteEnabled ? previous?.ante || previous?.big || 50 : 0,
              minutes: previous?.minutes ?? 15,
            },
      ],
    });
  };
  const removeLevel = (index: number) => {
    const levels = draft.levels.filter((_, i) => i !== index);
    const updateCutoff = (extra: PokerExtra | null) =>
      extra
        ? {
            ...extra,
            throughLevel: Math.min(
              levels.length,
              Math.max(1, extra.throughLevel - Number(index + 1 <= extra.throughLevel)),
            ),
          }
        : null;
    patch({ levels, rebuy: updateCutoff(draft.rebuy), addOn: updateCutoff(draft.addOn) });
  };
  const shareTotal = sharesTotal(draft.prizeShares);
  const minutes = draft.levels.reduce((sum, level) => sum + (level.minutes || 0), 0);
  const structure = [
    `${draft.levels.length} ${draft.levels.length === 1 ? 'nivel' : 'niveles'}`,
    `${Math.floor(minutes / 60)} h ${minutes % 60} min`,
    draft.rebuy ? 'con recompras' : 'sin recompras',
    ...(draft.addOn ? ['con add-on'] : []),
  ].join(' · ');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (shareTotal !== 100) return setError('El reparto de premios debe sumar el 100 %.');

    const { levels } = draft;
    if (
      levels[0].big === 0 ||
      levels[levels.length - 1].big === 0 ||
      levels.some((level) => level.big > 0 && (level.small === 0 || level.small >= level.big))
    ) {
      return setError(
        'Pon un nivel de ciegas al principio y al final. La ciega grande debe superar a la pequeña.',
      );
    }
    setError('');
    await onSave(day, {
      ...draft,
      // Aquí el reparto va por porcentajes; las cantidades fijas solo se fijan en juego y no
      // deben heredarse del torneo anterior, cuyo bote era otro.
      prizeAmounts: null,
      levels: draft.levels.map((level) => ({
        ...level,
        ante: anteEnabled && level.big > 0 ? level.ante : 0,
      })),
    });
  }

  return (
    <form
      className="paper-panel album-sheet poker-panel poker-form"
      onSubmit={(event) => void submit(event)}
      onInvalidCapture={(event) => {
        const details = (event.target as HTMLElement).closest('details');
        if (details) details.open = true;
      }}
    >
      <h2>{editing ? 'Editar torneo' : 'Preparar torneo'}</h2>
      <div className="poker-fields poker-basics">
        <label>
          Fecha
          <input
            type="date"
            className="glass-input"
            required
            value={day}
            onChange={(event) => setDay(event.target.value)}
          />
        </label>
        <NumberField
          label="Entrada (€)"
          cents
          value={draft.buyInCents}
          onChange={(buyInCents) => patch({ buyInCents })}
        />
        <NumberField
          label="Fichas iniciales"
          min={1}
          value={draft.startingChips}
          onChange={(startingChips) => patch({ startingChips })}
        />
      </div>

      <fieldset className="poker-fieldset">
        <legend>Reparto de premios</legend>
        <PokerPrizeShares
          draft={{ mode: 'percent', values: draft.prizeShares }}
          onChange={({ values }) => patch({ prizeShares: values })}
        />
      </fieldset>

      <details className="poker-details">
        <summary>
          <span>Ciegas, recompras y add-on</span>
          <span className="poker-note">{structure}</span>
        </summary>
        <div className="poker-detail-content">
          <p className="poker-note">
            El reloj pasa al siguiente nivel o descanso al agotarse el tiempo.
          </p>
          <label className="poker-check">
            <input
              type="checkbox"
              checked={anteEnabled}
              onChange={(event) => {
                const enabled = event.target.checked;
                setAnteEnabled(enabled);
                if (enabled) {
                  patch({
                    levels: draft.levels.map((level) => ({
                      ...level,
                      ante: level.big > 0 ? level.ante || level.big : 0,
                    })),
                  });
                }
              }}
            />
            Activar ante
          </label>
          <p className="poker-note">
            Al activarlo, los niveles sin ante toman el valor de la ciega grande. Puedes ajustar
            cada importe. Al desactivarlo, todos los niveles se guardan sin ante.
          </p>
          <div className="poker-level-list">
            {draft.levels.map((level, index) => {
              const rest = level.big === 0 && level.small === 0;
              return (
                <div
                  role="group"
                  aria-label={`${rest ? 'Descanso' : 'Ciegas'} · nivel ${index + 1}`}
                  className={rest ? 'poker-level is-break' : 'poker-level'}
                  key={index}
                >
                  <p className="poker-level-name">
                    <span>{index + 1}</span>
                    {rest ? 'Descanso' : 'Ciegas'}
                  </p>
                  <div className="poker-fields poker-level-fields">
                    {!rest && (
                      <>
                        <NumberField
                          label="Pequeña"
                          min={1}
                          value={level.small}
                          onChange={(small) => updateLevel(index, { small })}
                        />
                        <NumberField
                          label="Grande"
                          min={1}
                          value={level.big}
                          onChange={(big) => updateLevel(index, { big })}
                        />
                        {anteEnabled && (
                          <NumberField
                            label="Ante"
                            value={level.ante}
                            onChange={(ante) => updateLevel(index, { ante })}
                          />
                        )}
                      </>
                    )}
                    <NumberField
                      label="Minutos"
                      min={1}
                      max={120}
                      value={level.minutes}
                      onChange={(minutes) => updateLevel(index, { minutes })}
                    />
                  </div>
                  <button
                    type="button"
                    className="glass-btn poker-level-remove"
                    disabled={draft.levels.length <= 1}
                    onClick={() => removeLevel(index)}
                    aria-label={`Quitar nivel ${index + 1}`}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              );
            })}
          </div>
          <div className="poker-actions">
            <button
              type="button"
              className="glass-btn"
              disabled={draft.levels.length >= 30}
              onClick={() => appendLevel(false)}
            >
              Añadir nivel
            </button>
            <button
              type="button"
              className="glass-btn"
              disabled={draft.levels.length >= 30}
              onClick={() => appendLevel(true)}
            >
              Añadir descanso
            </button>
          </div>
          <ExtraFields
            label="Permitir recompras"
            extra={draft.rebuy}
            settings={draft}
            multiple
            onChange={(rebuy) => patch({ rebuy })}
          />
          <ExtraFields
            label="Ofrecer un add-on (extra de fichas)"
            extra={draft.addOn}
            settings={draft}
            onChange={(addOn) => patch({ addOn })}
          />
        </div>
      </details>
      {error && (
        <p className="create-league-error is-block" role="alert">
          {error}
        </p>
      )}
      <div className="poker-actions">
        <button type="submit" className="glass-btn primary-btn" disabled={busy}>
          {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Abrir inscripciones'}
        </button>
        <button type="button" className="glass-btn" onClick={onCancel} disabled={busy}>
          Volver
        </button>
      </div>
    </form>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 10_000_000,
  cents = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  cents?: boolean;
}) {
  const factor = cents ? 100 : 1;
  return (
    <label>
      {label}
      <input
        type="number"
        className="glass-input"
        required
        inputMode={cents ? 'decimal' : 'numeric'}
        step={cents ? '0.01' : '1'}
        min={min}
        max={cents ? 10_000 : max}
        value={Number.isNaN(value) ? '' : value / factor}
        onChange={(event) => onChange(Math.round(event.currentTarget.valueAsNumber * factor))}
      />
    </label>
  );
}

function ExtraFields({
  label,
  extra,
  settings,
  multiple,
  onChange,
}: {
  label: string;
  extra: PokerExtra | null;
  settings: PokerSettings;
  multiple?: boolean;
  onChange: (extra: PokerExtra | null) => void;
}) {
  return (
    <fieldset className="poker-fieldset">
      <legend>{label}</legend>
      <label className="poker-check">
        <input
          type="checkbox"
          checked={Boolean(extra)}
          onChange={(event) =>
            onChange(
              event.target.checked
                ? {
                    costCents: settings.buyInCents,
                    chips: settings.startingChips,
                    limit: multiple ? null : 1,
                    throughLevel: Math.min(settings.levels.length, multiple ? 4 : 5),
                  }
                : null,
            )
          }
        />
        {multiple ? 'Activar recompras' : 'Activar add-on'}
      </label>
      {extra && (
        <div className="poker-fields">
          <NumberField
            label="Importe (€)"
            value={extra.costCents}
            cents
            onChange={(costCents) => onChange({ ...extra, costCents })}
          />
          <NumberField
            label="Fichas"
            min={1}
            value={extra.chips}
            onChange={(value) => onChange({ ...extra, chips: value })}
          />
          {multiple && (
            <label className="poker-check">
              <input
                type="checkbox"
                checked={extra.limit === null}
                onChange={(event) => onChange({ ...extra, limit: event.target.checked ? null : 1 })}
              />
              Sin límite por jugador
            </label>
          )}
          {multiple && extra.limit !== null && (
            <NumberField
              label="Máximo por jugador"
              min={1}
              max={20}
              value={extra.limit}
              onChange={(limit) => onChange({ ...extra, limit })}
            />
          )}
          <label>
            Hasta el final de
            <select
              className="glass-input"
              value={extra.throughLevel}
              onChange={(event) => onChange({ ...extra, throughLevel: Number(event.target.value) })}
            >
              {settings.levels.map((level, index) => (
                <option key={index} value={index + 1}>
                  {index + 1} ·{' '}
                  {level.big === 0 && level.small === 0
                    ? 'Descanso'
                    : `${chips(level.small)} / ${chips(level.big)}`}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </fieldset>
  );
}
