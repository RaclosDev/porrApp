import PaperLoading from '../PaperLoading';
import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useTournamentData } from '../../context/leagueData';
import GroupStandingsCard from './GroupStandingsCard';
import GroupMatchesModal from '../GroupMatchesModal';
import BestThirdsPanel from './BestThirdsPanel';
import LiveMatchesPanel from './LiveMatchesPanel';
import TopScorersPanel from './TopScorersPanel';
import type { SelectedGroup } from '../GroupMatchesModal';
import type { TeamOdds } from '../../types/api';
import { useSortedGroups } from '../../hooks/useSortedGroups';
import { isMathematicallyEliminated, isMathematicallyQualified } from '../../utils/groupStatus';
import InkStamp from '../InkStamp';

/**
 * Componente que renderiza la vista oficial de fase de grupos del torneo:
 * tablas de posiciones por grupo, panel de mejores terceros, partidos en directo y pichichi.
 */
export default function OfficialGroupsView() {
  const { allGames, loading: loadingOfficial, matchRadar } = useAppContext();
  const {
    groupOdds,
    groupStandings: officialPoints,
    format,
    loading: loadingWorldCup,
    pichichi: activeGroupPichichi,
    topScorers,
    topScorersLoading,
    topScorersError,
    refreshTopScorers,
  } = useTournamentData();
  const loading = loadingOfficial || loadingWorldCup;

  const [selectedGroup, setSelectedGroup] = useState<SelectedGroup | null>(null);

  const sortedGroups = useSortedGroups();

  const renderGroup = (groupName: string, teams: TeamOdds[]) => {
    const rows = (sortedGroups[groupName] || []).map((team) => {
      let status = null;
      if (isMathematicallyQualified(team.stats.status)) {
        status = (
          <InkStamp tone="ink" size="sm" label="Clasificado matemáticamente" className="ml-1">
            Clas.
          </InkStamp>
        );
      } else if (isMathematicallyEliminated(team.stats.status)) {
        status = (
          <InkStamp size="sm" label="Eliminado matemáticamente" className="ml-1">
            Elim.
          </InkStamp>
        );
      }
      return {
        name: team.name,
        diff: team.stats.diff,
        gls: team.stats.gls,
        fp: team.stats.fp,
        pts: team.stats.pts,
        status,
      };
    });

    return (
      <GroupStandingsCard
        key={groupName}
        groupName={groupName}
        rows={rows}
        selected={selectedGroup?.name === groupName}
        onToggle={() =>
          setSelectedGroup(selectedGroup?.name === groupName ? null : { name: groupName, teams })
        }
      />
    );
  };

  const hasGroupsData = groupOdds && Object.keys(groupOdds).length > 0;
  if (loading && !hasGroupsData) {
    return <PaperLoading label="Cargando grupos" />;
  }

  return (
    <div className="w-full">
      {/* Paneles superiores: Mejores Terceros, Partidos en Directo, Pichichi */}
      <div className="flex gap-5 justify-center items-stretch flex-wrap mb-7.5 w-full">
        <div className="flex-1 min-w-[min(100%,_380px)] flex justify-center items-start">
          <BestThirdsPanel officialPoints={officialPoints} qualifying={format.bestThirds} />
        </div>
        <div className="flex-1 min-w-[min(100%,_350px)] max-w-150 flex flex-col items-center">
          <LiveMatchesPanel
            liveMatches={matchRadar?.live || []}
            matchRadar={matchRadar}
            maxNext={1}
          />
        </div>
        {activeGroupPichichi && (
          <div className="pichichi-mobile-center flex-1 min-w-[min(100%,_380px)] flex justify-center items-start">
            <TopScorersPanel
              topScorers={topScorers}
              loading={topScorersLoading}
              error={topScorersError}
              onRetry={refreshTopScorers}
            />
          </div>
        )}
      </div>

      <div id="home-standings-grid" className="groups-grid">
        {hasGroupsData &&
          Object.keys(groupOdds).map((groupName) => renderGroup(groupName, groupOdds[groupName]))}
      </div>
      <GroupMatchesModal
        selectedGroup={selectedGroup}
        allGames={allGames}
        onClose={() => setSelectedGroup(null)}
      />
    </div>
  );
}
