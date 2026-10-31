import { useId, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMatchdayStats } from '../../hooks/useMatchdayStats';
import { groupByRound, latestRound } from '../../utils/matchdayStats';
import { isApiError } from '../../services/apiError';
import MatchStatsCard from './MatchStatsCard';
import { InsightsNotice } from './InsightCard';

const stepClass =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-line bg-[rgba(255,255,255,0.05)] text-main disabled:cursor-not-allowed disabled:opacity-35';

/**
 * Estadísticas de una liga por jornadas: por cada partido que ya ha empezado, qué ha
 * pronosticado la liga. Antes del pitido inicial los pronósticos de los demás están ocultos.
 */
export default function MatchdayStatsView({ groupId }: { groupId: string }) {
  const { data, isPending, error } = useMatchdayStats(groupId);
  const [params, setParams] = useSearchParams();
  const selectId = useId();

  const rounds = useMemo(() => groupByRound(data?.matches ?? []), [data]);
  const requested = params.get('jornada');
  const selected =
    rounds.find((r) => r.label === requested) ??
    rounds.find((r) => r.label === latestRound(rounds));
  const index = selected ? rounds.indexOf(selected) : -1;

  const select = (label: string) => setParams({ jornada: label }, { replace: true });

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-card h-55" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <InsightsNotice title="No se han podido cargar las estadísticas">
        {isApiError(error, 403)
          ? 'Solo los miembros de la liga pueden verlas.'
          : 'Comprueba la conexión e inténtalo de nuevo.'}
      </InsightsNotice>
    );
  }
  if (!selected) {
    return (
      <InsightsNotice title="Todavía no hay partidos que mostrar">
        Los pronósticos de cada partido se ven en cuanto empieza. Entonces aparecerá aquí qué ha
        puesto la liga.
      </InsightsNotice>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          className={stepClass}
          onClick={() => select(rounds[index - 1].label)}
          disabled={index <= 0}
          aria-label="Jornada anterior"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <label htmlFor={selectId} className="sr-only">
          Jornada
        </label>
        <select
          id={selectId}
          className="glass-input min-w-0 max-w-65 flex-1 font-bold"
          value={selected.label}
          onChange={(e) => select(e.target.value)}
        >
          {rounds.map((r) => (
            <option key={r.label} value={r.label}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={stepClass}
          onClick={() => select(rounds[index + 1].label)}
          disabled={index >= rounds.length - 1}
          aria-label="Jornada siguiente"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="m-0 text-center text-[0.85rem] text-muted">
        Solo salen los partidos que ya han empezado: antes, los pronósticos de los demás están
        ocultos.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {selected.matches.map((m) => (
          <MatchStatsCard key={m.matchId} match={m} members={data.members} />
        ))}
      </div>
    </div>
  );
}
