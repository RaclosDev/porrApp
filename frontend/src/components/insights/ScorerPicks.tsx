import { useMemo } from 'react';
import type { PredictionData } from '../../types/api';
import { isRealScorer, rankScorers } from '../../utils/scorerPicks';
import { ExpandableList, InsightCard } from './InsightCard';
import PickRow from './PickRow';

/** El pichichi más elegido de la liga y, si ya se sabe, quién lo fue. */
export default function ScorerPicks({
  entries,
  real,
  finished,
}: {
  entries: { data: PredictionData }[];
  /** Máximos goleadores reales (varios si empatan). */
  real: string[];
  /** El torneo ha terminado: el pichichi ya es definitivo. */
  finished: boolean;
}) {
  const scorers = useMemo(() => rankScorers(entries), [entries]);
  if (scorers.length === 0) return null;

  return (
    <InsightCard
      title="Pichichi más elegido"
      subtitle={
        real.length > 0 ? `${finished ? 'Pichichi' : 'Va líder'}: ${real.join(', ')}.` : undefined
      }
    >
      <ExpandableList
        items={scorers}
        initial={6}
        noun="jugadores"
        render={(scorer) => {
          const hit = isRealScorer(scorer.name, real);
          return (
            <PickRow
              key={scorer.name}
              label={scorer.name}
              count={scorer.count}
              total={entries.length}
              percent={scorer.percent}
              status={finished ? (hit ? 'yes' : 'no') : 'pending'}
              statusText={{ yes: 'Fue el pichichi', no: 'No fue el pichichi' }}
              highlight={finished && hit}
            />
          );
        }}
      />
    </InsightCard>
  );
}
