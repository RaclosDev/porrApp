import { Check } from 'lucide-react';
import { LEAGUE_STEPS } from './leagueDraft';

/**
 * Pasos del asistente. Se puede volver a cualquiera ya alcanzado; los siguientes se abren al
 * completar los anteriores. En móvil se ven solo los números y el paso actual con su nombre.
 */
export default function WizardSteps({
  current,
  reachable,
  onSelect,
}: {
  current: number;
  /** Último paso al que se puede saltar (el primero con algo pendiente). */
  reachable: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Pasos para crear la liga">
      <ol className="create-league-steps">
        {LEAGUE_STEPS.map((step, index) => {
          const done = index < current;
          const isCurrent = index === current;
          const name = `Paso ${index + 1}: ${step.label}${done ? ' (hecho)' : ''}`;
          const content = (
            <>
              <span className="create-league-step-num" aria-hidden="true">
                {done ? <Check size={14} strokeWidth={3} /> : index + 1}
              </span>
              <span className="create-league-step-label">{step.label}</span>
            </>
          );
          return (
            <li
              key={step.id}
              className={`create-league-step${isCurrent ? ' is-current' : ''}${done ? ' is-done' : ''}`}
            >
              {!isCurrent && index <= reachable ? (
                <button type="button" onClick={() => onSelect(index)} aria-label={name}>
                  {content}
                </button>
              ) : (
                <span aria-current={isCurrent ? 'step' : undefined} aria-label={name}>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
