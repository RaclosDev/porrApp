import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import PokerDatePicker, { isoDay } from './PokerDatePicker';
import InfoTip from '../InfoTip';
import type {
  BlindLevel,
  PactPoints,
  PokerExtra,
  PokerSettings,
} from '../../services/endpoints/poker';
import PokerPrizeShares, { sharesTotal } from './PokerPrizeShares';
import { chips, noLeadingZero, withBreakAfterCutoff } from './pokerFormat';
import { DEFAULT_ROUNDING_CENTS, placePoints } from './pokerPayouts';
import SelectMenu from '../SelectMenu';

/** Pasos del formulario, para no enseñarlo todo de golpe. */
const STEPS = ['Torneo', 'Ciegas', 'Premios'];

interface Props {
  date: string;
  settings: PokerSettings;
  editing: boolean;
  /** Con el torneo en juego: sin fecha, y en el primer paso van los jugadores de la mesa. */
  live?: ReactNode;
  busy: boolean;
  onCancel: () => void;
  onSave: (date: string, settings: PokerSettings) => Promise<boolean>;
}

export default function PokerSettingsForm({
  date,
  settings,
  editing,
  live,
  busy,
  onCancel,
  onSave,
}: Props) {
  const [day, setDay] = useState(date);
  const [draft, setDraft] = useState(() =>
    withBreakAfterCutoff(withBreakAfterCutoff(settings, 'rebuy'), 'addOn'),
  );
  const [anteEnabled, setAnteEnabled] = useState(settings.levels.some((level) => level.ante > 0));
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [showPoints, setShowPoints] = useState(Boolean(settings.prizePoints));
  const [levelsOpen, setLevelsOpen] = useState(false);
  const stepRef = useRef<HTMLDivElement>(null);
  const patch = (changes: Partial<PokerSettings>) =>
    setDraft((previous) => ({ ...previous, ...changes }));
  /** Al activar un extra o mover su corte se añade un descanso detrás para comprar en él. */
  const patchExtra = (key: 'rebuy' | 'addOn', extra: PokerExtra | null) =>
    setDraft((previous) => {
      const next = { ...previous, [key]: extra };
      const moved = extra && extra.throughLevel !== previous[key]?.throughLevel;
      return moved ? withBreakAfterCutoff(next, key) : next;
    });
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

  const { levels } = draft;
  const levelsOk = !(
    levels[0].big === 0 ||
    levels[levels.length - 1].big === 0 ||
    levels.some((level) => level.big > 0 && (level.small === 0 || level.small >= level.big))
  );
  const levelsError =
    'Pon un nivel de ciegas al principio y al final. La ciega grande debe superar a la pequeña.';

  /** Cambia de paso; para avanzar, el paso actual tiene que estar bien. */
  function goTo(target: number) {
    if (target > step) {
      const inputs = [...(stepRef.current?.querySelectorAll('input') ?? [])];
      if (!inputs.every((input) => input.reportValidity())) return;
      if (step === 1 && !levelsOk) {
        setLevelsOpen(true);
        return setError(levelsError);
      }
    }
    setError('');
    setStep(target);
    // El paso de ciegas es largo: al cambiar, se vuelve al principio del formulario.
    stepRef.current?.closest('form')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!editing && step < STEPS.length - 1) return goTo(step + 1);
    if (!levelsOk) {
      setStep(1);
      setLevelsOpen(true);
      return setError(levelsError);
    }
    if (shareTotal !== 100) {
      setStep(2);
      return setError('El reparto de premios debe sumar el 100 %.');
    }
    setError('');
    await onSave(day, {
      ...draft,
      // Aquí el reparto va por porcentajes; las cantidades fijas solo se fijan en juego y no
      // deben heredarse del torneo anterior, cuyo bote era otro. En juego se conservan.
      prizeAmounts: live ? draft.prizeAmounts : null,
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
    >
      <h2>{live ? 'Editar torneo en juego' : editing ? 'Editar torneo' : 'Preparar torneo'}</h2>
      <ol className="poker-form-steps">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              className={index < step ? 'is-done' : undefined}
              aria-current={index === step ? 'step' : undefined}
              onClick={() => goTo(index)}
            >
              <span aria-hidden="true">{index + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>
      <div
        ref={stepRef}
        className="poker-form-step"
        // Un campo mal puesto dentro de los niveles plegados los despliega para verlo.
        onInvalidCapture={(event) => {
          if ((event.target as HTMLElement).closest('details')) setLevelsOpen(true);
        }}
      >
        {step === 0 && (
          <div className="poker-fields poker-basics">
            {live}
            {!live && <PokerDatePicker label="Fecha" value={day} onChange={setDay} />}
            <div
              className="poker-date-picks"
              role="group"
              aria-label="Fechas rápidas"
              hidden={Boolean(live)}
            >
              {quickDates().map((pick) => (
                <button
                  key={pick.value}
                  type="button"
                  className={day === pick.value ? 'is-active' : undefined}
                  aria-pressed={day === pick.value}
                  onClick={() => setDay(pick.value)}
                >
                  {pick.label}
                </button>
              ))}
            </div>
            <NumberField
              label="Entrada"
              unit="€"
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
        )}
        {step === 1 && (
          <div className="poker-detail-content">
            <section
              role="group"
              aria-label="Ante"
              className={anteEnabled ? 'poker-extra is-on' : 'poker-extra'}
            >
              <label className="poker-extra-head">
                <span>
                  <span className="poker-extra-title">Ante</span>
                  <span className="poker-note">
                    {anteEnabled
                      ? 'Cada nivel lleva su ante; ajústalo en los niveles.'
                      : 'Todos ponen fichas en cada mano, además de las ciegas.'}
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className="poker-switch"
                  aria-label="Activar ante"
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
              </label>
            </section>
            <ExtraFields
              label="Recompras"
              extra={draft.rebuy}
              settings={draft}
              multiple
              onChange={(rebuy) => patchExtra('rebuy', rebuy)}
            />
            <ExtraFields
              label="Add-on"
              extra={draft.addOn}
              settings={draft}
              onChange={(addOn) => patchExtra('addOn', addOn)}
            />
            <details
              className="poker-details"
              open={levelsOpen}
              onToggle={(event) => setLevelsOpen(event.currentTarget.open)}
            >
              <summary>
                Niveles de ciegas
                <span className="poker-note">{structure}</span>
              </summary>
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
            </details>
          </div>
        )}
        {step === 2 && (
          <fieldset className="poker-fieldset">
            <legend>Reparto de premios</legend>
            <label className="poker-points-toggle">
              <span>
                Puntos de liga
                <span className="poker-note">
                  Elige cuántos suma cada puesto en la clasificación
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                className="poker-switch"
                checked={showPoints}
                onChange={(event) => setShowPoints(event.currentTarget.checked)}
              />
            </label>
            <PokerPrizeShares
              draft={{ mode: 'percent', values: draft.prizeShares }}
              onChange={({ values }) =>
                patch({
                  prizeShares: values,
                  prizePoints: draft.prizePoints && placePoints(values.length, draft.prizePoints),
                })
              }
              points={
                showPoints ? placePoints(draft.prizeShares.length, draft.prizePoints) : undefined
              }
              onPointsChange={(prizePoints) => patch({ prizePoints })}
            />
            <div className="poker-fields">
              <NumberField
                label="Redondear el reparto a"
                unit="€"
                cents
                min={0.01}
                value={draft.roundingCents ?? DEFAULT_ROUNDING_CENTS}
                onChange={(roundingCents) => patch({ roundingCents })}
              />
              <div className="poker-field">
                <span className="poker-title-with-tip">
                  Puntos si pactan
                  <InfoTip label="Qué son los puntos si pactan">
                    Cómo se reparten los puntos de liga si los últimos que quedan pactan el premio.
                    Se puede cambiar más tarde, al editar o cerrar el torneo.
                  </InfoTip>
                </span>
                <SelectMenu
                  className="glass-input"
                  label="Puntos si pactan"
                  value={draft.pactPoints ?? 'EQUAL'}
                  onChange={(next) => patch({ pactPoints: next as PactPoints })}
                  items={[
                    { value: 'EQUAL', label: 'A partes iguales' },
                    { value: 'ICM', label: 'Según ICM (fichas)' },
                  ]}
                />
              </div>
            </div>
          </fieldset>
        )}
      </div>
      {error && (
        <p className="create-league-error is-block" role="alert">
          {error}
        </p>
      )}
      <div className="poker-actions poker-form-actions">
        {step > 0 ? (
          <button type="button" className="glass-btn" onClick={() => goTo(step - 1)}>
            Atrás
          </button>
        ) : (
          <button type="button" className="glass-btn" onClick={onCancel} disabled={busy}>
            Volver
          </button>
        )}
        {editing && step < STEPS.length - 1 && (
          <button type="button" className="glass-btn" onClick={() => goTo(step + 1)}>
            Siguiente
          </button>
        )}
        <button type="submit" className="glass-btn primary-btn" disabled={busy}>
          {busy
            ? 'Guardando…'
            : editing
              ? 'Guardar cambios'
              : step < STEPS.length - 1
                ? 'Siguiente'
                : 'Abrir inscripciones'}
        </button>
      </div>
    </form>
  );
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Hoy y los próximos viernes y sábado, los días de timba de siempre. */
function quickDates(today = new Date()) {
  const picks = [{ value: isoDay(today), label: 'Hoy' }];
  for (const weekday of [5, 6]) {
    const date = new Date(today);
    date.setDate(today.getDate() + ((weekday - today.getDay() + 7) % 7 || 7));
    picks.push({ value: isoDay(date), label: `${WEEKDAYS[weekday]} ${date.getDate()}` });
  }
  return picks;
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  min = 0,
  max = 10_000_000,
  cents = false,
}: {
  label: string;
  /** Unidad que se ve dentro de la casilla; el nombre accesible la lleva entre paréntesis. */
  unit?: string;
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
      <span className={unit ? 'poker-input-unit' : undefined} data-unit={unit}>
        <input
          type="number"
          className="glass-input"
          required
          aria-label={unit ? `${label} (${unit})` : undefined}
          inputMode={cents ? 'decimal' : 'numeric'}
          step={cents ? '0.01' : '1'}
          min={min}
          max={cents ? 10_000 : max}
          value={Number.isNaN(value) ? '' : value / factor}
          onChange={(event) => onChange(Math.round(noLeadingZero(event.currentTarget) * factor))}
        />
      </span>
    </label>
  );
}

/** Recompras o add-on: una tarjeta con interruptor; al activarla, sus cuatro datos en rejilla. */
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
  const name = multiple ? 'recompras' : 'add-on';
  const summary = extra
    ? `${(extra.costCents / 100).toLocaleString('es-ES')} € → ${chips(extra.chips)} fichas · hasta el nivel ${extra.throughLevel}`
    : multiple
      ? 'Quien se quede sin fichas puede volver a comprar.'
      : 'Una compra extra de fichas para todos, una sola vez.';
  return (
    <section
      role="group"
      aria-label={label}
      className={extra ? 'poker-extra is-on' : 'poker-extra'}
    >
      <label className="poker-extra-head">
        <span>
          <span className="poker-extra-title">{label}</span>
          <span className="poker-note">{summary}</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="poker-switch"
          aria-label={`Activar ${name}`}
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
      </label>
      {extra && (
        <div className="poker-fields poker-extra-fields">
          <NumberField
            label="Importe"
            unit="€"
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
            <label>
              Por jugador
              <SelectMenu
                className="glass-input"
                label="Recompras por jugador"
                value={String(extra.limit ?? 0)}
                onChange={(next) => onChange({ ...extra, limit: Number(next) || null })}
                items={[
                  { value: '0', label: 'Sin límite' },
                  ...Array.from({ length: 20 }, (_, index) => ({
                    value: String(index + 1),
                    label: index === 0 ? '1 como máximo' : `${index + 1} como máximo`,
                  })),
                ]}
              />
            </label>
          )}
          <label className={multiple ? undefined : 'poker-extra-wide'}>
            Hasta el final de
            <SelectMenu
              className="glass-input"
              label="Hasta el final de"
              value={String(extra.throughLevel)}
              onChange={(next) => onChange({ ...extra, throughLevel: Number(next) })}
              items={settings.levels.map((level, index) => ({
                value: String(index + 1),
                label: `${index + 1} · ${
                  level.big === 0 && level.small === 0
                    ? 'Descanso'
                    : `${chips(level.small)} / ${chips(level.big)}`
                }`,
              }))}
            />
          </label>
        </div>
      )}
    </section>
  );
}
