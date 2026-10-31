import PaperLoading from '../PaperLoading';
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
    return <PaperLoading label="Cargando estadísticas" embedded />;
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
