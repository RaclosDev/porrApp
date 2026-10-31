import type { ReactNode } from 'react';
import type { useBracketInsights } from '../../hooks/useBracketInsights';
import { InsightsNotice } from './InsightCard';

type Insights = ReturnType<typeof useBracketInsights>;

const formatLockDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('es-ES', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Esqueleto mientras llegan los cuadros. */
function InsightsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-hidden="true">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton skeleton-text medium mb-4 h-5" />
          {Array.from({ length: 5 }).map((_, j) => (
            <div key={j} className="mb-3">
              <div className="skeleton-row mb-1.5">
                <div className="skeleton skeleton-avatar" />
                <div className="skeleton skeleton-bar max-w-30" />
              </div>
              <div className="skeleton h-2 w-full rounded-[10px]" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Muestra las estadísticas solo cuando hay cuadros que comparar: antes del cierre los de los
 * demás están ocultos, y con eso no hay nada que agregar.
 */
export default function BracketInsightsGate({
  insights,
  children,
}: {
  insights: Insights;
  children: ReactNode;
}) {
  if (!insights.hasLeague) {
    return (
      <InsightsNotice title="No hay ninguna liga seleccionada">
        Elige una liga en el menú de arriba para ver sus estadísticas.
      </InsightsNotice>
    );
  }
  if (insights.loading) {
    return (
      <>
        <p role="status" className="sr-only">
          Cargando estadísticas…
        </p>
        <InsightsSkeleton />
      </>
    );
  }
  if (insights.error) {
    return (
      <InsightsNotice title="No se han podido cargar los cuadros de la liga">
        Comprueba la conexión e inténtalo de nuevo.
      </InsightsNotice>
    );
  }
  if (insights.hiddenCount > 0) {
    const lock = formatLockDate(insights.lockDate);
    const sent = insights.hiddenCount + insights.entries.length;
    return (
      <InsightsNotice title="Los cuadros de los demás aún están ocultos">
        Se podrán ver cuando cierre el plazo{lock ? `, el ${lock}` : ''}. De momento hay {sent}{' '}
        {sent === 1 ? 'cuadro enviado' : 'cuadros enviados'}.
      </InsightsNotice>
    );
  }
  if (insights.entries.length === 0) {
    return (
      <InsightsNotice title="Todavía no hay cuadros en esta liga">
        Cuando los participantes envíen su cuadro, aquí verás qué eligen.
      </InsightsNotice>
    );
  }
  return children;
}
