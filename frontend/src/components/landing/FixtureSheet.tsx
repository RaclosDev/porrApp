import Flag from '../Flag';
import type { Match } from '../../types/api';

interface FixtureSheetProps {
  fixtures: Match[];
  onPick: () => void;
  loading: boolean;
  error: boolean;
  refreshing: boolean;
  onRetry: () => void;
}

const formatKickoff = (date: string | null) => {
  if (!date) return '';
  const d = new Date(date);
  return `${d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
};

export default function FixtureSheet({
  fixtures,
  onPick,
  loading,
  error,
  refreshing,
  onRetry,
}: FixtureSheetProps) {
  if (fixtures.length === 0) {
    return (
      <div className="text-[#4b5563] text-sm">
        <p role="status">
          {error
            ? 'No se han podido cargar los próximos partidos de LaLiga.'
            : loading
              ? 'Cargando próximos partidos de LaLiga…'
              : 'No hay próximos partidos de LaLiga disponibles.'}
        </p>
        {error && (
          <button
            type="button"
            className="landing-btn mt-3"
            onClick={onRetry}
            disabled={refreshing}
          >
            {refreshing ? 'Reintentando…' : 'Reintentar partidos'}
          </button>
        )}
      </div>
    );
  }
  const round = fixtures[0].round;

  return (
    <div className="flex flex-col gap-3">
      <p className="marker-ink text-lg">{round}</p>
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
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className="landing-btn self-start" onClick={onPick}>
        Iniciar sesión para pronosticar
      </button>
    </div>
  );
}
