import { useEffect, useRef } from 'react';
import type { CardSegment } from '../../types/api';
import { CARD_SEGMENTS, SEGMENT_LABELS, SEGMENT_UFC_NAMES } from '../../utils/fights';
import { FIELD_IDS, errorId } from './leagueDraft';
import { FieldError } from './parts';
import type { StepProps } from './useLeagueDraft';

/**
 * UFC: qué partes de la cartelera de cada velada entran en la liga. «Toda la velada» marca o desmarca
 * las tres y queda a medias si solo hay alguna; hace falta al menos una.
 */
export default function CardSegmentsField({ draft, update, errors }: StepProps) {
  const allRef = useRef<HTMLInputElement>(null);
  const chosen = draft.cardSegments;
  const all = chosen.length === CARD_SEGMENTS.length;
  const some = chosen.length > 0 && !all;
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = some;
  }, [some]);
  const toggle = (segment: CardSegment, on: boolean) =>
    update({
      cardSegments: CARD_SEGMENTS.filter((item) => (item === segment ? on : chosen.includes(item))),
    });
  const fieldId = FIELD_IDS.cardSegments;
  return (
    <fieldset
      id={fieldId}
      className="create-league-fieldset create-league-segments"
      aria-describedby={errors.cardSegments ? errorId(fieldId) : undefined}
    >
      <legend className="create-league-section-title">Peleas de cada velada</legend>
      <p className="create-league-hint">
        Solo las peleas de las partes marcadas entran en la liga.
      </p>
      <label className="create-league-check">
        <input
          ref={allRef}
          type="checkbox"
          checked={all}
          aria-controls={CARD_SEGMENTS.map((segment) => `cl-segment-${segment}`).join(' ')}
          onChange={() => update({ cardSegments: all ? [] : [...CARD_SEGMENTS] })}
        />
        <span>
          Toda la velada{' '}
          <span className="create-league-hint">Early Prelims, Prelims y Main Card.</span>
        </span>
      </label>
      <div className="create-league-segments-list">
        {CARD_SEGMENTS.map((segment) => (
          <label key={segment} className="create-league-check">
            <input
              id={`cl-segment-${segment}`}
              type="checkbox"
              checked={chosen.includes(segment)}
              onChange={(event) => toggle(segment, event.target.checked)}
            />
            <span>
              {SEGMENT_LABELS[segment]}{' '}
              <span className="create-league-hint">{SEGMENT_UFC_NAMES[segment]}</span>
            </span>
          </label>
        ))}
      </div>
      <FieldError fieldId={fieldId} message={errors.cardSegments} />
    </fieldset>
  );
}
