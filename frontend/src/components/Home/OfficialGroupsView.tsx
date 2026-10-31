import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import Flag from '../Flag';
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
  const {
    groupOdds,
    officialPoints,
    allGames,
    nameToIdMap,
    loading,
    matchRadar,
    topScorers,
    topScorersLoading,
    topScorersError,
    refreshTopScorers,
    activeGroupPichichi,
  } = useAppContext();

  const [selectedGroup, setSelectedGroup] = useState<SelectedGroup | null>(null);

  const sortedGroups = useSortedGroups();

  const renderGroup = (groupName: string, teams: TeamOdds[]) => {
    const teamsWithStats = sortedGroups[groupName] || [];

    return (
      <div
        key={groupName}
        className={`group-card paper-panel album-sheet relative cursor-pointer ${selectedGroup?.name === groupName ? 'z-[100]' : 'z-[1]'} ${selectedGroup?.name === groupName ? 'border border-accent' : ''} ${selectedGroup?.name === groupName ? '[outline:2px_solid_var(--accent-cyan)]' : '[outline:none]'}`}
        role="button"
        tabIndex={0}
        aria-label={`Ver detalles del Grupo ${groupName}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (selectedGroup?.name === groupName) setSelectedGroup(null);
            else setSelectedGroup({ name: groupName, teams });
          }
        }}
        id={`group-card-${groupName}`}
        onClick={() => {
          if (selectedGroup?.name === groupName) setSelectedGroup(null);
          else setSelectedGroup({ name: groupName, teams });
        }}
      >
        <div className="flex justify-between items-center mb-2.5">
          <h3 className="album-sheet-title mb-0 text-left">Grupo {groupName}</h3>
          <div className="flex gap-2 text-[0.75em] font-bold text-muted pr-1.5">
            <span className="w-5 text-center">DG</span>
            <span className="w-4 text-center">GF</span>
            <span className="w-4.5 text-center">FP</span>
            <span className="w-6 text-center">PTS</span>
          </div>
        </div>

        {teamsWithStats.map((team, idx) => {
          let statusDot = null;
          if (isMathematicallyQualified(team.stats.status)) {
            statusDot = (
              <InkStamp tone="ink" size="sm" label="Clasificado matemáticamente" className="ml-1">
                Clas.
              </InkStamp>
            );
          } else if (isMathematicallyEliminated(team.stats.status)) {
            statusDot = (
              <InkStamp size="sm" label="Eliminado matemáticamente" className="ml-1">
                Elim.
              </InkStamp>
            );
          }

          return (
            <div
              className={`flex items-center py-1.5 px-2 mb-1 rounded-[6px] ${idx < 2 ? 'bg-[rgba(17,_24,_39,_0.04)] bg-none' : 'bg-transparent bg-none'}`}
              key={team.name}
            >
              <span className="w-4.5 font-bold text-muted text-[0.85em] shrink-0">{idx + 1}</span>
              <span className="inline-flex items-center mr-[5px] shrink-0">
                <Flag team={team.name} />
              </span>
              <span
                className={`grow whitespace-nowrap overflow-hidden text-ellipsis mr-2 ${idx < 2 ? 'font-bold' : 'font-normal'}`}
              >
                {team.name}
              </span>
              {statusDot}
              <div className="flex gap-2 text-[0.85em] text-muted">
                <span
                  className="w-5 text-center"
                  style={{
                    color:
                      team.stats.diff > 0
                        ? 'var(--hit)'
                        : team.stats.diff < 0
                          ? 'var(--miss)'
                          : 'inherit',
                  }}
                >
                  {team.stats.diff > 0 ? `+${team.stats.diff}` : team.stats.diff}
                </span>
                <span className="w-4 text-center">{team.stats.gls}</span>
                <span className="w-4.5 text-center">{team.stats.fp}</span>
                <span className="w-6 text-center font-bold text-main">{team.stats.pts}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const hasGroupsData = groupOdds && Object.keys(groupOdds).length > 0;
  if (loading && !hasGroupsData) {
    return (
      <section className="view-section block">
        <div className="groups-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton skeleton-text short h-4.5 mb-3.5" />
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="skeleton-row">
                  <div className="skeleton skeleton-avatar" />
                  <div className="skeleton skeleton-bar" />
                  <div className="skeleton w-7 h-3.5 rounded-[4px]" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="w-full">
      {/* Paneles superiores: Mejores Terceros, Partidos en Directo, Pichichi */}
      <div className="flex gap-5 justify-center items-stretch flex-wrap mb-7.5 w-full">
        <div className="flex-1 min-w-[min(100%,_380px)] flex justify-center items-start">
          <BestThirdsPanel
            officialPoints={officialPoints}
            allGames={allGames}
            nameToIdMap={nameToIdMap}
          />
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
