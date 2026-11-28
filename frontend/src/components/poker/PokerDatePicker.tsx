import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

const WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Fecha local en formato AAAA-MM-DD, el mismo que guarda el torneo. */
export const isoDay = (date: Date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, '0'))
    .join('-');

const parseDay = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const longDate = (date: Date) =>
  date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Selector de fecha con el aspecto de la app: toda la fila abre un mes desplegado
 * debajo, sin el calendario del sistema. No deja elegir días ya pasados.
 */
export default function PokerDatePicker({
  label,
  value,
  onChange,
  today = new Date(),
  past = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  today?: Date;
  /** Para corregir un torneo ya jugado: deja elegir cualquier día, también los pasados. */
  past?: boolean;
}) {
  const panelId = useId();
  const selected = parseDay(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );
  const todayIso = isoDay(today);
  const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  function toggle() {
    if (!open) setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    setOpen(!open);
  }

  function shift(months: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + months, 1));
  }

  function pick(day: string) {
    onChange(day);
    setOpen(false);
  }

  // Escape cierra el mes desplegado.
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);

  // Huecos hasta el lunes de la primera semana y luego los días del mes.
  const blanks = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthName = month.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <div className="poker-date-field poker-date-picker">
      <span className="poker-date-label">{label}</span>
      <button
        type="button"
        className="glass-input poker-date-button"
        aria-label={`${label}: ${longDate(selected)}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
      >
        <span className="first-letter:uppercase">{longDate(selected)}</span>
        <CalendarDays size={18} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={panelId}
          className="poker-calendar"
          role="group"
          aria-label={`Elegir ${label.toLowerCase()}`}
        >
          <div className="poker-calendar-head">
            <button
              type="button"
              aria-label="Mes anterior"
              disabled={!past && month <= firstMonth}
              onClick={() => shift(-1)}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <p aria-live="polite">{monthName}</p>
            <button type="button" aria-label="Mes siguiente" onClick={() => shift(1)}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="poker-calendar-grid">
            {WEEK.map((weekday) => (
              <span key={weekday} className="poker-calendar-weekday" aria-hidden="true">
                {weekday}
              </span>
            ))}
            {Array.from({ length: blanks }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
              const day = isoDay(date);
              const classes = [day === todayIso && 'is-today', day === value && 'is-selected']
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={day}
                  type="button"
                  className={classes || undefined}
                  aria-label={longDate(date)}
                  aria-pressed={day === value}
                  disabled={!past && day < todayIso && day !== value}
                  onClick={() => pick(day)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
