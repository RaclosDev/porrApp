import { useMemo } from 'react';
import Flag from '../Flag';
import { compareTeams } from '../../utils/points';
import type { GroupStandings, Match, TeamStanding } from '../../types/api';

interface ThirdPlaceRow extends TeamStanding {
  group: string;
  name: string;
}

interface BestThirdsPanelProps {
  officialPoints: GroupStandings;
  allGames: Match[];
  nameToIdMap: Record<string, number>;
}

function BestThirdsPanel({ officialPoints, allGames, nameToIdMap }: BestThirdsPanelProps) {
  const thirds = useMemo(() => {
    if (!officialPoints || Object.keys(officialPoints).length === 0) return [];

    const arr: ThirdPlaceRow[] = [];
    Object.keys(officialPoints).forEach((groupName) => {
      const groupData = officialPoints[groupName];
      const teamNames = Object.keys(groupData);

      // Fast-path: pick the 3rd place team directly by materialized position
      const thirdTeamName = teamNames.find((name) => groupData[name]?.pos === 3);
      if (thirdTeamName) {
        arr.push({ group: groupName, name: thirdTeamName, ...groupData[thirdTeamName] });
      } else {
        const teamsWithStats = teamNames.map((teamName) => ({
          name: teamName,
          ...groupData[teamName],
        }));

        teamsWithStats.sort((a, b) =>
          compareTeams(a, b, groupName, officialPoints, allGames, nameToIdMap),
        );

        if (teamsWithStats.length >= 3) {
          arr.push({ group: groupName, ...teamsWithStats[2] });
        }
      }
    });

    arr.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.diff !== a.diff) return b.diff - a.diff;
      if (b.gls !== a.gls) return b.gls - a.gls;

      const fpA = a.fp || 0;
      const fpB = b.fp || 0;
      if (fpB !== fpA) return fpB - fpA;

      return a.name.localeCompare(b.name);
    });

    return arr;
  }, [officialPoints, allGames, nameToIdMap]);

  if (thirds.length === 0) return null;

  return (
    <div className="w-full max-w-145 my-0 mx-auto flex flex-col gap-2">
      <div className="text-center text-[#00cec9] text-[1rem] font-bold p-1.5 bg-[rgba(0,_206,_201,_0.1)] bg-none border border-[rgba(0,_206,_201,_0.3)] rounded-[12px]">
        🥉 MEJORES TERCEROS
      </div>
      <div className="bg-(color:--bg-card) bg-none rounded-[12px] border border-[rgba(255,255,255,0.05)] p-2.5">
        <div className="grid grid-cols-[repeat(auto-fit,_minmax(200px,_1fr))] gap-4">
          <div className="flex flex-col">
            <div className="grid grid-cols-[20px_1fr_25px_30px_28px] gap-1.5 pb-1.5 border-b border-b-[rgba(255,255,255,0.1)] text-[0.75rem] text-muted font-bold text-center">
              <span>#</span>
              <span className="text-left">Equipo</span>
              <span>PT</span>
              <span>DF</span>
              <span title="Fair Play (Tarjetas)">FP</span>
            </div>
            <div className="flex flex-col">
              {thirds.slice(0, 6).map((t, idx) => {
                const isTop8 = idx < 8;
                const rank = idx + 1;

                return (
                  <div
                    className="grid grid-cols-[20px_1fr_25px_30px_28px] gap-1.5 py-[5px] px-0 items-center text-[0.85rem]"
                    key={t.name}
                  >
                    <span
                      className={`font-bold text-center ${isTop8 ? 'text-[#00b894]' : 'text-muted'}`}
                    >
                      {rank}
                    </span>
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <Flag team={t.name} style={{ borderRadius: '2px', flexShrink: 0 }} />
                      <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                        {t.name}
                      </span>
                    </div>
                    <span className="font-bold text-center bg-[rgba(255,255,255,0.08)] bg-none rounded-[4px]">
                      {t.pts}
                    </span>
                    <span className="text-center text-muted">
                      {t.diff > 0 ? `+${t.diff}` : t.diff}
                    </span>
                    <span
                      className="text-center text-muted text-[0.75rem]"
                      title="Puntos de Fair Play"
                    >
                      {t.fp || 0}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="grid grid-cols-[20px_1fr_25px_30px_28px] gap-1.5 pb-1.5 border-b border-b-[rgba(255,255,255,0.1)] text-[0.75rem] text-muted font-bold text-center">
              <span>#</span>
              <span className="text-left">Equipo</span>
              <span>PT</span>
              <span>DF</span>
              <span title="Fair Play (Tarjetas)">FP</span>
            </div>
            <div className="flex flex-col">
              {thirds.slice(6, 12).map((t, idx) => {
                const globalIdx = idx + 6;
                const hasPlayed = t.mp > 0;
                const isTop8 = hasPlayed && globalIdx < 8;
                const rank = hasPlayed ? globalIdx + 1 : '-';

                return (
                  <div
                    className={`grid grid-cols-[20px_1fr_25px_30px_28px] gap-1.5 py-[5px] px-0 items-center text-[0.85rem] ${globalIdx === 7 ? 'border-b-2 [border-bottom-style:dashed] border-b-[rgba(255,_71,_87,_0.5)]' : 'border-b-0'}`}
                    key={t.name}
                    style={{ opacity: isTop8 ? 1 : hasPlayed ? 0.5 : 0.3 }}
                  >
                    <span
                      className={`font-bold text-center ${isTop8 ? 'text-[#00b894]' : 'text-muted'}`}
                    >
                      {rank}
                    </span>
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <Flag team={t.name} style={{ borderRadius: '2px', flexShrink: 0 }} />
                      <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                        {t.name}
                      </span>
                    </div>
                    <span className="font-bold text-center bg-[rgba(255,255,255,0.08)] bg-none rounded-[4px]">
                      {t.pts}
                    </span>
                    <span className="text-center text-muted">
                      {t.diff > 0 ? `+${t.diff}` : t.diff}
                    </span>
                    <span
                      className="text-center text-muted text-[0.75rem]"
                      title="Puntos de Fair Play"
                    >
                      {t.fp || 0}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BestThirdsPanel;
