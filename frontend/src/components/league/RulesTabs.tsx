import type { KeyboardEvent, ReactNode } from 'react';

export type RulesTab = 'scoring' | 'norms';

const TABS: { id: RulesTab; label: string }[] = [
  { id: 'scoring', label: 'Puntuación' },
  { id: 'norms', label: 'Normas' },
];

/** Pestañas "Puntuación" y "Normas" de las reglas de una liga. */
export default function RulesTabs({
  idPrefix,
  tab,
  onChange,
  badges = {},
}: {
  idPrefix: string;
  tab: RulesTab;
  onChange: (tab: RulesTab) => void;
  /** Marca junto a la etiqueta, p. ej. de cambios sin guardar. */
  badges?: Partial<Record<RulesTab, ReactNode>>;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = tab === 'scoring' ? 'norms' : 'scoring';
    onChange(next);
    document.getElementById(`${idPrefix}-tab-${next}`)?.focus();
  };

  return (
    <div className="rules-tabs" role="tablist" aria-label="Reglas de la liga">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${id}`}
          aria-selected={tab === id}
          aria-controls={`${idPrefix}-panel-${id}`}
          tabIndex={tab === id ? 0 : -1}
          className={tab === id ? 'is-active' : ''}
          onClick={() => onChange(id)}
          onKeyDown={handleKeyDown}
        >
          {label}
          {badges[id]}
        </button>
      ))}
    </div>
  );
}
