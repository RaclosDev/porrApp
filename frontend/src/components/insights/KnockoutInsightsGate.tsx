import type { ReactNode } from 'react';
import PaperLoading from '../PaperLoading';
import type { useKnockoutInsights } from '../../hooks/useKnockoutInsights';
import { InsightsNotice } from './InsightCard';

type Insights = ReturnType<typeof useKnockoutInsights>;

const formatLock = (value: string | null) => {
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

/**
 * Muestra las estadísticas de un cuadro solo cuando ya hay elecciones cerradas: mientras un cruce
 * se puede cambiar, lo que ha puesto cada uno sigue oculto.
 */
export default function KnockoutInsightsGate({
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
    return <PaperLoading label="Cargando estadísticas" embedded />;
  }
  if (insights.error) {
    return (
      <InsightsNotice title="No se han podido cargar las predicciones de la liga">
        Comprueba la conexión e inténtalo de nuevo.
      </InsightsNotice>
    );
  }
  if (insights.entries.length === 0) {
    const lock = formatLock(insights.nextLockAt);
    const sent = insights.sentCount;
    return (
      <InsightsNotice title="Todavía no hay predicciones cerradas">
        Lo que pone cada uno se ve cuando se cierra cada cruce.
        {lock && ` El próximo cierre es el ${lock}.`}
        {sent > 0 &&
          ` De momento hay ${sent} ${sent === 1 ? 'predicción enviada' : 'predicciones enviadas'}.`}
      </InsightsNotice>
    );
  }
  return children;
}
