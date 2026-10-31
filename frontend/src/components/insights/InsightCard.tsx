import { useId, useState, type ReactNode } from 'react';
import Flag from '../Flag';

/** Bandera de tamaño fijo para las filas de estadísticas. */
export const TeamFlag = ({ team }: { team: string }) => (
  <Flag
    team={team}
    size="w80"
    style={{ width: 22, height: 16, objectFit: 'cover', borderRadius: 3 }}
  />
);

interface InsightCardProps {
  title: string;
  icon?: ReactNode;
  /** Línea bajo el título: el dato real o cómo leer la tarjeta. */
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Tarjeta de una estadística. */
export function InsightCard({
  title,
  icon,
  subtitle,
  children,
  footer,
  className = '',
}: InsightCardProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={`min-w-0 rounded-[14px] border border-line bg-panel p-3.5 sm:p-4.5 ${className}`}
    >
      <h3 id={titleId} className="m-0 flex items-center gap-2 text-[1.05rem] font-bold text-main">
        {icon && <span aria-hidden="true">{icon}</span>}
        {title}
      </h3>
      {subtitle && <p className="mt-1 mb-0 text-[0.85rem] text-muted">{subtitle}</p>}
      <div className="mt-3">{children}</div>
      {footer && (
        <div className="mt-3 border-t border-line pt-3 text-[0.85rem] text-muted">{footer}</div>
      )}
    </section>
  );
}

/** Lista con las primeras filas y un botón para ver el resto. */
export function ExpandableList<T>({
  items,
  initial,
  render,
  noun,
}: {
  items: T[];
  initial: number;
  render: (item: T) => ReactNode;
  /** Qué se cuenta en el botón: "equipos", "jugadores"… */
  noun: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const visible = expanded ? items : items.slice(0, initial);
  return (
    <>
      <ul id={listId} className="m-0 flex list-none flex-col gap-1 p-0">
        {visible.map(render)}
      </ul>
      {items.length > initial && (
        <button
          type="button"
          className="glass-btn mt-2 w-full text-[0.88rem] text-accent-text"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Ver menos' : `Ver los ${items.length} ${noun}`}
        </button>
      )}
    </>
  );
}

/** Selector de una opción entre varias (rondas, posiciones…), con desplazamiento en móvil. */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="mb-tabs m-0 mb-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`mb-tab flex-[1_0_auto] px-2 ${opt.value === value ? 'mb-tab-active' : ''}`}
          aria-pressed={opt.value === value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Aviso centrado para los estados sin datos. */
export function InsightsNotice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div
      role="status"
      className="mx-auto max-w-130 rounded-[14px] border border-line bg-panel px-5 py-8 text-center"
    >
      <p className="m-0 text-[1.05rem] font-bold text-main">{title}</p>
      {children && <div className="mt-2 text-[0.92rem] text-muted">{children}</div>}
    </div>
  );
}
