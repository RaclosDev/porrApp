import Flag from '../Flag';
import type { Match } from '../../types/api';

interface FixtureSheetProps {
  fixtures: Match[];
  onPick: () => void;
}

const formatKickoff = (date: string | null) => {
  if (!date) return '';
  const d = new Date(date);
  return `${d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * Hoja de la próxima jornada de LaLiga con los partidos reales. Los botones 1 X 2 funcionan:
 * abren el inicio de sesión, que es lo que hace falta para pronosticar.
 */
export default function FixtureSheet({ fixtures, onPick }: FixtureSheetProps) {
  if (fixtures.length === 0) {
    return (
      <p className="text-[#4b5563] text-sm">
        LaLiga no tiene partidos programados ahora mismo; la hoja se rellena sola cuando los hay.
      </p>
    );
  }
  const round = fixtures[0].round;

  return (
    <div className="flex flex-col gap-3">
      <p className="landing-marker text-lg">{round}</p>
      <ul className="flex flex-col divide-y divide-[rgba(17,24,39,0.15)]">
        {fixtures.map((m) => (
          <li
            key={m.id}
            className="grid grid-cols-[1fr_auto_1fr] gap-x-2 gap-y-2 py-3 items-center"
          >
            <span className="flex items-center gap-2 min-w-0 text-[#111827] font-semibold">
              <Flag team={m.home} logo={m.homeLogo || m.homeTeamLogo} />
              <span className="truncate">{m.home}</span>
            </span>
            <span className="text-xs text-[#4b5563]" aria-hidden="true">
              vs
            </span>
            <span className="flex items-center gap-2 min-w-0 justify-end text-[#111827] font-semibold">
              <span className="truncate">{m.away}</span>
              <Flag team={m.away} logo={m.awayLogo || m.awayTeamLogo} />
            </span>
            <span className="col-span-3 flex items-center justify-between gap-3">
              <span className="text-xs text-[#4b5563]">{formatKickoff(m.date)}</span>
              <span
                className="flex gap-1.5"
                role="group"
                aria-label={`Pronóstico ${m.home} contra ${m.away}`}
              >
                {['1', 'X', '2'].map((sign) => (
                  <button
                    key={sign}
                    type="button"
                    onClick={onPick}
                    className="landing-pick"
                    aria-label={`${sign}: inicia sesión para pronosticar`}
                  >
                    {sign}
                  </button>
                ))}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
