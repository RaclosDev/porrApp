import { Fragment } from 'react';
import type { FightInfo } from '../../types/api';
import { FIGHT_OUTCOME_LABELS, fightResultParts, type FightOutcome } from '../../utils/fights';

/** Insignia del resultado de un luchador: W en azul, L en rojo; D y NC, neutras. */
export function FightBadge({
  outcome,
  size = 'md',
}: {
  outcome: FightOutcome;
  size?: 'sm' | 'md';
}) {
  const label = FIGHT_OUTCOME_LABELS[outcome];
  return (
    <span
      className={`fight-badge is-${outcome.toLowerCase()}${size === 'sm' ? ' is-sm' : ''}`}
      title={label}
    >
      <span aria-hidden="true">{outcome}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Cómo acabó una pelea: «Sumisión (mataleón) · Asalto 2 · 1:25». Nada si aún no hay datos. */
export function FightResultLine({
  fight,
  className = '',
  as: Tag = 'p',
}: {
  fight: FightInfo | null | undefined;
  className?: string;
  /** `span` dentro de un elemento en línea. */
  as?: 'p' | 'span';
}) {
  const parts = fightResultParts(fight);
  if (parts.length === 0) return null;
  const clock = fight?.resultClock ?? null;
  return (
    <Tag className={`fight-result${className ? ` ${className}` : ''}`}>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="fight-result-sep"> · </span>}
          <span className={index === 0 ? 'fight-result-method' : undefined}>
            {clock && part === clock && index === parts.length - 1 && (
              <span className="sr-only">Tiempo: </span>
            )}
            {part}
          </span>
        </Fragment>
      ))}
    </Tag>
  );
}
