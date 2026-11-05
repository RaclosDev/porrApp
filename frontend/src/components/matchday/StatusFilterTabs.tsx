import type { StatusFilter } from '../../utils/matchday';

interface StatusFilterTabsProps {
  value: StatusFilter;
  onChange: (filter: StatusFilter) => void;
  counts: { upcoming: number; pending: number; finished: number };
}

const TABS: {
  filter: StatusFilter;
  label: string;
  modifier: string;
  count: keyof StatusFilterTabsProps['counts'];
}[] = [
  { filter: 'UPCOMING', label: 'Todos', modifier: '', count: 'upcoming' },
  { filter: 'PENDING', label: 'Pendientes', modifier: ' is-pending', count: 'pending' },
  { filter: 'FINISHED', label: 'Finalizados', modifier: ' is-finished', count: 'finished' },
];

/** Pestañas de filtro: por jugar («Todos»), sin pronosticar («Pendientes») y finalizados. */
export default function StatusFilterTabs({ value, onChange, counts }: StatusFilterTabsProps) {
  return (
    <div className="md-filters" role="tablist" aria-label="Filtro de partidos">
      {TABS.map(({ filter, label, modifier, count }) => (
        <button
          key={filter}
          type="button"
          role="tab"
          aria-selected={value === filter}
          onClick={() => onChange(filter)}
          className={`md-filter${modifier}${value === filter ? ' is-active' : ''}`}
        >
          {label} <b>{counts[count]}</b>
        </button>
      ))}
    </div>
  );
}
