import type { SurvivorStatus } from '../../types/api';

interface SurvivorStatusBarProps {
  status: SurvivorStatus | null;
  /** NFL: se juega por semanas («Semana 9»), no por jornadas. */
  weeks?: boolean;
}

/**
 * Superviviente: si el usuario sigue vivo, cuántas jornadas lleva superadas, cuántas vidas le quedan
 * (si la liga da más de una) y qué equipos ya ha usado (no se pueden repetir).
 */
export default function SurvivorStatusBar({ status, weeks = false }: SurvivorStatusBarProps) {
  const unit = weeks ? 'semana' : 'jornada';
  const survived = status?.survived ?? 0;
  const used = (status?.picks ?? []).map((pick) => pick.teamName).filter(Boolean);
  const round = status?.eliminatedRound;
  const lives = status?.lives ?? 1;
  const livesLeft = status?.livesLeft ?? lives;
  const failure = lives > 1 ? 'pierdes una vida' : 'quedas eliminado';
  const howTo = `Elige un equipo que gane en cada ${unit}, sin repetirlo. ${
    status?.drawSurvives ? 'El empate también te salva. ' : ''
  }Si no eliges, ${failure}.`;
  return (
    <div
      className={`md-survivor-status${status?.eliminated ? ' is-out' : ''}`}
      role="status"
      aria-live="polite"
    >
      {status?.eliminated ? (
        <strong>
          Eliminado{round ? ` en ${weeks ? 'la ' : ''}${round}` : ''}
          {status.missed ? ' por no elegir equipo' : ''}
        </strong>
      ) : (
        <strong>Sigues vivo</strong>
      )}
      <span>
        {survived} {survived === 1 ? `${unit} superada` : `${unit}s superadas`}
      </span>
      {lives > 1 && !status?.eliminated && (
        <span>
          {livesLeft} de {lives} vidas
        </span>
      )}
      <span className="text-muted">
        {used.length > 0 ? `Equipos usados: ${used.join(', ')}` : howTo}
      </span>
    </div>
  );
}
