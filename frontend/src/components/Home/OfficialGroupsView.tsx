import { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { compareTeams } from '../../utils/points';
import Flag from '../Flag';
import GroupMatchesModal from '../GroupMatchesModal';
import BestThirdsPanel from './BestThirdsPanel';
import LiveMatchesPanel from './LiveMatchesPanel';
import TopScorersPanel from './TopScorersPanel';

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

  const [selectedGroup, setSelectedGroup] = useState(null);

  const sortedGroups = useMemo(() => {
    if (!groupOdds) return {};
    const res = {};
    Object.entries(groupOdds).forEach(([groupName, teams]) => {
      const teamsWithStats = (teams || []).map((t) => {
        const safeKey = t.name.replace(/[.#$[\]]/g, '');
        const stats = officialPoints?.[groupName]?.[safeKey] || {
          pts: 0,
          diff: 0,
          gls: 0,
          mp: 0,
          fp: 0,
        };
        return { ...t, stats };
      });

      teamsWithStats.sort((a, b) => {
        if (a.stats?.pos && b.stats?.pos) {
          return a.stats.pos - b.stats.pos;
        }
        return compareTeams(a, b, groupName, officialPoints, allGames, nameToIdMap);
      });
      res[groupName] = teamsWithStats;
    });
    return res;
  }, [groupOdds, officialPoints, allGames, nameToIdMap]);

  const renderGroup = (groupName, teams) => {
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
          }}
        >
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
          <div
            style={{
              display: 'flex',
              gap: '8px',
              fontSize: '0.75em',
              fontWeight: 'bold',
              color: 'var(--text-muted)',
              paddingRight: '6px',
            }}
          >
            <span style={{ width: '20px', textAlign: 'center' }}>DG</span>
            <span style={{ width: '16px', textAlign: 'center' }}>GF</span>
            <span style={{ width: '18px', textAlign: 'center' }}>FP</span>
            <span style={{ width: '24px', textAlign: 'center' }}>PTS</span>
          </div>
        </div>

        {teamsWithStats.map((team, idx) => {
          let statusDot = null;
          if (team.stats.status === 5) {
            statusDot = (
              <span
                title="Clasificado Matemáticamente"
                aria-label="Clasificado Matemáticamente"
                style={{
                  width: '8px',
                  height: '8px',
                  background: '#3498db',
                  borderRadius: '50%',
                  marginLeft: '4px',
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
            );
          } else if (team.stats.status === -1) {
            statusDot = (
              <span
                title="Eliminado Matemáticamente"
                aria-label="Eliminado Matemáticamente"
                style={{
                  width: '8px',
                  height: '8px',
                  background: '#ff4757',
                  borderRadius: '50%',
                  marginLeft: '4px',
                  flexShrink: 0,
                  display: 'inline-block',
                }}
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
              <span
                style={{
                  width: '18px',
                  fontWeight: 'bold',
                  color: 'var(--text-muted)',
                  fontSize: '0.85em',
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '5px', flexShrink: 0 }}>
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
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  fontSize: '0.85em',
                  color: 'var(--text-muted)',
                }}
              >
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
                <span style={{ width: '16px', textAlign: 'center' }}>{team.stats.gls}</span>
                <span style={{ width: '18px', textAlign: 'center' }}>{team.stats.fp}</span>
                <span
                  style={{
                    width: '24px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: 'var(--text-main)',
                  }}
                >
                  {team.stats.pts}
                </span>
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
      <section className="view-section" style={{ display: 'block' }}>
        <div className="groups-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div
                className="skeleton skeleton-text short"
                style={{ height: '18px', marginBottom: '14px' }}
              />
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="skeleton-row">
                  <div className="skeleton skeleton-avatar" />
                  <div className="skeleton skeleton-bar" />
                  <div
                    className="skeleton"
                    style={{ width: '28px', height: '14px', borderRadius: '4px' }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Paneles superiores: Mejores Terceros, Partidos en Directo, Pichichi */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          justifyContent: 'center',
          alignItems: 'stretch',
          flexWrap: 'wrap',
          marginBottom: '30px',
          width: '100%',
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 'min(100%, 380px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
          }}
        >
          <BestThirdsPanel
            officialPoints={officialPoints}
            allGames={allGames}
            nameToIdMap={nameToIdMap}
          />
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 'min(100%, 350px)',
            maxWidth: '600px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <LiveMatchesPanel
            liveMatches={matchRadar?.live || []}
            matchRadar={matchRadar}
            maxNext={1}
          />
        </div>
        {activeGroupPichichi && (
          <div
            style={{
              flex: 1,
              minWidth: 'min(100%, 380px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
            }}
            className="pichichi-mobile-center"
          >
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
