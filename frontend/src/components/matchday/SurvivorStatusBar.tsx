import type { SurvivorStatus } from '../../types/api';

interface SurvivorStatusBarProps {
  status: SurvivorStatus | null;
}

/**
 * Superviviente: si el usuario sigue vivo, cuántas jornadas lleva superadas y qué equipos ya ha
 * usado (no se pueden repetir).
 */
export default function SurvivorStatusBar({ status }: SurvivorStatusBarProps) {
  const survived = status?.survived ?? 0;
  const used = (status?.picks ?? []).map((pick) => pick.teamName).filter(Boolean);
  const round = status?.eliminatedRound;
  return (
    <div
      className={`md-survivor-status${status?.eliminated ? ' is-out' : ''}`}
      role="status"
      aria-live="polite"
    >
      {status?.eliminated ? (
        <strong>
          Eliminado{round ? ` en ${round}` : ''}
          {status.missed ? ' por no elegir equipo' : ''}
        </strong>
      ) : (
        <strong>Sigues vivo</strong>
      )}
      <span>
        {survived} {survived === 1 ? 'jornada superada' : 'jornadas superadas'}
      </span>
      <span className="text-muted">
        {used.length > 0
          ? `Equipos usados: ${used.join(', ')}`
          : 'Elige un equipo que gane en cada jornada, sin repetirlo. Si no eliges, quedas eliminado.'}
      </span>
    </div>
  );
}
