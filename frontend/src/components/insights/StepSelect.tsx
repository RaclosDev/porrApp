import { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const stepClass =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-line bg-[rgba(17,24,39,0.05)] text-main disabled:cursor-not-allowed disabled:opacity-35';

interface StepSelectProps {
  /** Qué se elige: «Jornada», «Gran Premio»… */
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

/** Selector con flechas para pasar de una jornada (o de un Gran Premio) a la de al lado. */
export default function StepSelect({ label, options, value, onChange }: StepSelectProps) {
  const selectId = useId();
  const index = options.findIndex((option) => option.value === value);
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        className={stepClass}
        onClick={() => onChange(options[index - 1].value)}
        disabled={index <= 0}
        aria-label={`${label} anterior`}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <label htmlFor={selectId} className="sr-only">
        {label}
      </label>
      <select
        id={selectId}
        className="glass-input min-w-0 max-w-65 flex-1 font-bold"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={stepClass}
        onClick={() => onChange(options[index + 1].value)}
        disabled={index < 0 || index >= options.length - 1}
        aria-label={`${label} siguiente`}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
