import type { ReactNode } from 'react';
import PaperLoading from '../PaperLoading';
import type { useGrandPrixInsights } from '../../hooks/useGrandPrixInsights';
import { InsightsNotice } from './InsightCard';

type Insights = ReturnType<typeof useGrandPrixInsights>;

/**
 * Muestra las estadísticas de Fórmula 1 solo cuando hay algún Gran Premio cerrado: hasta que
 * empieza la clasificación, las predicciones de los demás están ocultas.
 */
export default function GrandPrixInsightsGate({
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
  if (insights.races.length === 0) {
    return (
      <InsightsNotice title="Todavía no hay ningún Gran Premio cerrado">
        Las predicciones de los demás se ven cuando empieza la clasificación de cada Gran Premio.
        Entonces aparecerá aquí qué ha puesto la liga.
      </InsightsNotice>
    );
  }
  return children;
}
