import { useMemo } from 'react';
import type { GroupStageEntry, GroupStageTournament } from '../../utils/groupStageBracket';
import { groupWinnerPicks } from '../../utils/groupStagePicks';
import { InsightCard } from './InsightCard';
import { KnockoutTeamIcon, type TeamLogos } from './KnockoutStats';
import PickRow from './PickRow';

/** Fase de grupos: el primero más elegido de cada grupo y, si el grupo ha terminado, el real. */
export default function GroupWinnerPicks({
  entries,
  tournament,
  logos,
}: {
  entries: GroupStageEntry[];
  tournament: GroupStageTournament;
  logos: TeamLogos;
}) {
  const winners = useMemo(() => groupWinnerPicks(entries, tournament), [entries, tournament]);
  if (winners.length === 0) return null;

  return (
    <InsightCard
      title="Primero de grupo más elegido"
      subtitle="El favorito de la liga en cada grupo y, si el grupo ha terminado, el primero real."
      className="lg:col-span-2"
    >
      <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {winners.map(({ group, team, count, percent, real }) => (
          <PickRow
            key={group}
            icon={<KnockoutTeamIcon team={team} logos={logos} />}
            label={
              <>
                <span className="text-muted">{group} · </span>
                {team}
              </>
            }
            count={count}
            total={entries.length}
            percent={percent}
            status={real ? (real === team ? 'yes' : 'no') : 'pending'}
            statusText={{ yes: 'Fue primero', no: 'No fue primero' }}
            note={real && real !== team ? `1º: ${real}` : undefined}
            highlight={real === team}
            to={`/search?team=${encodeURIComponent(team)}&round=first`}
          />
        ))}
      </ul>
    </InsightCard>
  );
}
