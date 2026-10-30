import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useSortedGroups } from '../hooks/useSortedGroups';
import { normalizeCountryName } from '../utils/constants';
import Flag from '../components/Flag';
import GroupMatchesModal, { type SelectedGroup } from '../components/GroupMatchesModal';
import type { TeamOdds } from '../types/api';
import OfficialBracket from './OfficialBracket';
import BestThirdsPanel from '../components/Home/BestThirdsPanel';
import LiveMatchesPanel from '../components/Home/LiveMatchesPanel';
import TopScorersPanel from '../components/Home/TopScorersPanel';
import MatchdayHomeDashboard from '../components/Home/MatchdayHomeDashboard';
import { isMathematicallyEliminated, isMathematicallyQualified } from '../utils/groupStatus';
import InkStamp from '../components/InkStamp';

/**
 * Página principal: estado del torneo oficial, clasificación por grupos en vivo,
 * mejores terceros, partidos en directo y goleadores. Alterna entre la vista de
 * fase de grupos y el cuadro eliminatorio oficial.
 */
function Home({ defaultMode = 'bracket' }: { defaultMode?: 'bracket' | 'groups' }) {
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
    activeGroupPoolFormat,
    activeCompetitionFormatType,
    loadingGroup,
    groupError,
  } = useAppContext();
  const [selectedGroup, setSelectedGroup] = useState<SelectedGroup | null>(null);
  const [viewMode, setViewMode] = useState(defaultMode);
  const [activeMobilePanel, setActiveMobilePanel] = useState<'thirds' | 'live' | 'scorers' | null>(
    null,
  );

  useEffect(() => {
    setViewMode(defaultMode);
  }, [defaultMode]);

  const sortedGroups = useSortedGroups();

  const isMatchDayLeague =
    activeGroupPoolFormat === 'MATCH_DAY' || activeCompetitionFormatType === 'LEAGUE';
  if (loadingGroup) return <p role="status">Cargando liga...</p>;
  if (groupError) return <p role="alert">No se pudo cargar la liga. Inténtalo de nuevo.</p>;
  if (isMatchDayLeague) {
    return <MatchdayHomeDashboard />;
  }

  // Si estamos en modo bracket, delegamos directamente en OfficialBracket sin mostrar nunca el skeleton de grupos
  if (viewMode === 'bracket') {
    return <OfficialBracket />;
  }

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

  const renderGroup = (groupName: string, teams: TeamOdds[]) => {
    const teamsWithStats = sortedGroups[groupName] || [];

    return (
      <div
        key={groupName}
        className={`group-card relative cursor-pointer ${selectedGroup?.name === groupName ? 'z-[100]' : 'z-[1]'} ${selectedGroup?.name === groupName ? 'border border-accent' : ''} ${selectedGroup?.name === groupName ? '[outline:2px_solid_var(--accent-cyan)]' : '[outline:none]'}`}
        role="button"
        tabIndex={0}
        aria-label={`Ver detalles del grupo ${groupName}`}
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
          <h3 className="m-0">Grupo {groupName}</h3>
          <div className="flex gap-2 text-[0.75em] font-bold text-muted pr-1.5">
            <span className="w-5 text-center">DG</span>
            <span className="w-4 text-center">GF</span>
            <span className="w-4.5 text-center">FP</span>
            <span className="w-6 text-center">Pts</span>
          </div>
        </div>

        {teamsWithStats.map((team, idx) => {
          let posColor = 'inherit';
          let borderLeftStyle = 'none';
          if (idx === 0) {
            posColor = 'var(--champion-gold)';
            borderLeftStyle = '3px solid var(--champion-gold)';
          } else if (idx === 1) {
            posColor = '#e0e0e0';
            borderLeftStyle = '3px solid #e0e0e0';
          } else if (idx === 2) {
            posColor = '#cd7f32';
            borderLeftStyle = '3px solid #cd7f32';
          }

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
              className={`flex items-center py-1.5 px-2 mb-1 ${idx < 2 ? 'bg-[rgba(255,_255,_255,_0.03)] bg-none' : 'bg-transparent bg-none'}`}
              key={team.name}
              style={{ borderLeft: borderLeftStyle, borderRadius: '0 6px 6px 0' }}
            >
              <span className="w-4.5 font-bold text-[0.85em] shrink-0" style={{ color: posColor }}>
                {idx + 1}
              </span>
              <Flag team={team.name} />
              <span className="grow whitespace-nowrap overflow-hidden text-ellipsis flex items-center">
                {normalizeCountryName(team.name)}
                {statusDot}
              </span>
              <div className="flex gap-2 text-[0.85em] items-center">
                <span className="w-5 text-center text-muted">
                  {team.stats.diff > 0 ? `+${team.stats.diff}` : team.stats.diff}
                </span>
                <span className="w-4 text-center text-muted">{team.stats.gls}</span>
                <span
                  className="w-4.5 text-center text-muted"
                  title={`Fair Play: ${team.stats.fp || 0}`}
                >
                  {team.stats.fp || 0}
                </span>
                <span className="font-bold bg-[rgba(255,255,255,0.08)] bg-none py-0.5 px-1.5 rounded-[4px] text-white w-6 text-center">
                  {team.stats.pts}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <section id="view-home" className="view-section block">
      {/* Pestañas y paneles de móvil (sólo en modo grupos) */}
      <div className="mb-tabs hide-on-desktop w-full max-w-105 mt-0 mb-5 mx-auto justify-center">
        <button
          type="button"
          aria-expanded={activeMobilePanel === 'thirds'}
          className={`mb-tab flex-1 text-center ${activeMobilePanel === 'thirds' ? 'mb-tab-active' : ''}`}
          onClick={() => setActiveMobilePanel((p) => (p === 'thirds' ? null : 'thirds'))}
        >
          Terceros
        </button>
        <button
          type="button"
          aria-expanded={activeMobilePanel === 'live'}
          className={`mb-tab flex-1 text-center ${activeMobilePanel === 'live' ? 'mb-tab-active' : ''}`}
          onClick={() => setActiveMobilePanel((p) => (p === 'live' ? null : 'live'))}
        >
          Partidos
        </button>
        {activeGroupPichichi && (
          <button
            type="button"
            aria-expanded={activeMobilePanel === 'scorers'}
            className={`mb-tab flex-1 text-center ${activeMobilePanel === 'scorers' ? 'mb-tab-active' : ''}`}
            onClick={() => setActiveMobilePanel((p) => (p === 'scorers' ? null : 'scorers'))}
          >
            Pichichi
          </button>
        )}
      </div>

      <div className="hide-on-desktop mb-5 flex flex-col items-center w-full">
        <div className={activeMobilePanel === 'thirds' ? '' : 'mobile-step-hidden'}>
          <BestThirdsPanel
            officialPoints={officialPoints}
            allGames={allGames}
            nameToIdMap={nameToIdMap}
          />
        </div>
        <div className={activeMobilePanel === 'live' ? '' : 'mobile-step-hidden'}>
          <LiveMatchesPanel
            liveMatches={matchRadar?.live || []}
            matchRadar={matchRadar}
            maxNext={1}
          />
        </div>
        {activeGroupPichichi && (
          <div className={activeMobilePanel === 'scorers' ? '' : 'mobile-step-hidden'}>
            <TopScorersPanel
              topScorers={topScorers}
              loading={topScorersLoading}
              error={topScorersError}
              onRetry={refreshTopScorers}
            />
          </div>
        )}
      </div>

      {/* Paneles desktop (siempre visibles, solo en groups) */}
      <div className="hide-on-mobile flex flex-wrap justify-center items-start mb-5 w-full gap-5">
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
        {Object.keys(groupOdds).map((groupName) => renderGroup(groupName, groupOdds[groupName]))}
      </div>
      <GroupMatchesModal
        selectedGroup={selectedGroup}
        allGames={allGames}
        onClose={() => setSelectedGroup(null)}
      />
    </section>
  );
}

export default Home;
