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
        className="group-card"
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
        style={{
          position: 'relative',
          zIndex: selectedGroup?.name === groupName ? 100 : 1,
          cursor: 'pointer',
          border: selectedGroup?.name === groupName ? '1px solid var(--accent-color)' : '',
          outline: selectedGroup?.name === groupName ? '2px solid var(--accent-cyan)' : 'none',
        }}
        onClick={() => {
          if (selectedGroup?.name === groupName) setSelectedGroup(null);
          else setSelectedGroup({ name: groupName, teams });
        }}
      >
        <div className="flex justify-between items-center mb-2.5">
          <h3
            style={{
              margin: 0,
              fontFamily: 'inherit',
              fontSize: '1rem',
              lineHeight: 1.25,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              textAlign: 'left',
            }}
          >
            Grupo {groupName}
          </h3>
          <div className="flex gap-2 text-[0.75em] font-bold text-muted pr-1.5">
            <span className="w-5 text-center">DG</span>
            <span className="w-4 text-center">GF</span>
            <span className="w-4.5 text-center">FP</span>
            <span className="w-6 text-center">PTS</span>
          </div>
        </div>

        {teamsWithStats.map((team, idx) => {
          let statusDot = null;
          if (team.stats.status === 5) {
            statusDot = (
              <span
                className="w-2 h-2 bg-[#3498db] rounded-full ml-1 shrink-0 inline-block"
                title="Clasificado Matemáticamente"
                aria-label="Clasificado Matemáticamente"
              />
            );
          } else if (team.stats.status === -1) {
            statusDot = (
              <span
                className="w-2 h-2 bg-[#ff4757] rounded-full ml-1 shrink-0 inline-block"
                title="Eliminado Matemáticamente"
                aria-label="Eliminado Matemáticamente"
              />
            );
          }

          return (
            <div
              key={team.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 8px',
                marginBottom: '4px',
                borderRadius: '6px',
                background: idx < 2 ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
              }}
            >
              <span className="w-4.5 font-bold text-muted text-[0.85em] shrink-0">{idx + 1}</span>
              <span className="inline-flex items-center mr-[5px] shrink-0">
                <Flag team={team.name} />
              </span>
              <span
                style={{
                  flexGrow: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginRight: '8px',
                  fontWeight: idx < 2 ? 'bold' : 'normal',
                }}
              >
                {team.name}
              </span>
              {statusDot}
              <div className="flex gap-2 text-[0.85em] text-muted">
                <span
                  style={{
                    width: '20px',
                    textAlign: 'center',
                    color:
                      team.stats.diff > 0 ? '#2ecc71' : team.stats.diff < 0 ? '#ff7675' : 'inherit',
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
