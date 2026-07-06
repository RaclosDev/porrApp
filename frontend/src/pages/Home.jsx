import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { compareTeams } from '../utils/points';
import { openStats } from '../utils/navigation';
import { fetchTopScorers } from '../services/api';
import Flag from '../components/Flag';
import GroupMatchesModal from '../components/GroupMatchesModal';
import OfficialBracket from './OfficialBracket';
import BestThirdsPanel from '../components/Home/BestThirdsPanel';
import LiveMatchesPanel from '../components/Home/LiveMatchesPanel';
import TopScorersPanel from '../components/Home/TopScorersPanel';

/**
 * Componente de la página principal (Home).
 * Muestra el estado actual del torneo oficial, la clasificación por grupos en vivo,
 * los mejores terceros, partidos en directo y la tabla de goleadores.
 * Permite alternar entre la vista de fase de grupos y la vista de bracket eliminatorio oficial.
 *
 * @component
 * @returns {JSX.Element} La página de inicio renderizada.
 */
function Home({ defaultMode = 'bracket', hideToggle = false }) {
  const { groupOdds, officialPoints, allGames, nameToIdMap, loading, matchRadar } = useAppContext();
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [topScorers, setTopScorers] = useState([]);
  const [viewMode, setViewMode] = useState(defaultMode);
  const [activeMobilePanel, setActiveMobilePanel] = useState(null); // null, 'thirds', 'live', 'scorers'

  useEffect(() => {
    setViewMode(defaultMode);
  }, [defaultMode]);
  const [imgErrors, setImgErrors] = useState({});

  useEffect(() => {
    fetchTopScorers().then(data => { if (data) setTopScorers(data); });
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando grupos...</div>;



  const renderGroup = (groupName, teams) => {
    // Map with stats
    const teamsWithStats = teams.map(t => {
      const safeKey = t.name.replace(/[.#$[\]]/g, "");
      const stats = (officialPoints?.[groupName]?.[safeKey]) || { pts: 0, diff: 0, gls: 0, mp: 0 };
      return { ...t, stats };
    });

    // Sort
    teamsWithStats.sort((a, b) => compareTeams(a, b, groupName, officialPoints, allGames, nameToIdMap));

    return (
      <div 
        key={groupName} 
        className="group-card" 
        id={`group-card-${groupName}`} 
        style={{ 
          position: 'relative', 
          zIndex: selectedGroup?.name === groupName ? 100 : 1,
          cursor: 'pointer', 
          border: selectedGroup?.name === groupName ? '1px solid var(--accent-color)' : '', 
          boxShadow: selectedGroup?.name === groupName ? '0 0 12px var(--accent-glow)' : '' 
        }}
        onClick={() => {
           if (selectedGroup?.name === groupName) setSelectedGroup(null);
           else setSelectedGroup({ name: groupName, teams });
        }}
      >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0 }}>Grupo {groupName}</h3>
            <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', paddingRight: '4px' }}>
              <span style={{ width: '20px', textAlign: 'center' }} title="Diferencia de goles">DF</span>
              <span style={{ width: '16px', textAlign: 'center' }} title="Goles a favor">GF</span>
              <span style={{ width: '24px', textAlign: 'center' }} title="Puntos">PT</span>
            </div>
          </div>
          {teamsWithStats.map((team, idx) => {
            let statusDot = null;
            if (team.stats.status === 5) {
              statusDot = <div title="Clasificado Matemáticamente" style={{ width: '6px', height: '6px', background: '#3498db', borderRadius: '50%', marginLeft: '5px', flexShrink: 0, boxShadow: '0 0 5px rgba(52,152,219,0.8)' }}></div>;
            }

            return (
            <div key={team.name} className="group-slot">
              <span style={{ fontWeight: 'bold', width: '20px', flexShrink: 0 }}>{idx + 1}.</span>
            <Flag team={team.name} style={{ width: '18px', height: '13px', marginRight: '8px' }} />
              <span style={{ flexGrow: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center' }}>{team.name}{statusDot}</span>
              <div style={{ display: 'flex', gap: '8px', fontSize: '0.85em', alignItems: 'center' }}>
                <span style={{ width: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>{team.stats.diff > 0 ? `+${team.stats.diff}` : team.stats.diff}</span>
                <span style={{ width: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>{team.stats.gls}</span>
                <span style={{ fontWeight: 'bold', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', color: 'white', width: '24px', textAlign: 'center' }}>{team.stats.pts}</span>
              </div>
            </div>
          )})}

      </div>
    );
  };

  return (
    <section id="view-home" className="view-section" style={{ display: 'block' }}>


        {/* Pestañas y paneles de móvil (sólo en modo grupos) */}
        {viewMode === 'groups' && (
          <>
            <div className="mb-tabs hide-on-desktop" style={{ width: '100%', maxWidth: '420px', margin: '0 auto 20px auto', justifyContent: 'center' }}>
              <button
                className={`mb-tab ${activeMobilePanel === 'thirds' ? 'mb-tab-active' : ''}`}
                onClick={() => setActiveMobilePanel(p => p === 'thirds' ? null : 'thirds')}
                style={{ flex: 1, textAlign: 'center', ...(activeMobilePanel === 'thirds' ? { background: 'rgba(0, 206, 201, 0.18)', borderColor: '#00cec9', color: '#00cec9', boxShadow: '0 0 14px rgba(0, 206, 201, 0.25)' } : {}) }}
              >🥉 Terceros</button>
              <button
                className={`mb-tab ${activeMobilePanel === 'live' ? 'mb-tab-active' : ''}`}
                onClick={() => setActiveMobilePanel(p => p === 'live' ? null : 'live')}
                style={{ flex: 1, textAlign: 'center', ...(activeMobilePanel === 'live' ? { background: 'rgba(255, 71, 87, 0.18)', borderColor: '#ff4757', color: '#ff4757', boxShadow: '0 0 14px rgba(255, 71, 87, 0.25)' } : {}) }}
              >🔴 Partidos</button>
              <button
                className={`mb-tab ${activeMobilePanel === 'scorers' ? 'mb-tab-active' : ''}`}
                onClick={() => setActiveMobilePanel(p => p === 'scorers' ? null : 'scorers')}
                style={{ flex: 1, textAlign: 'center', ...(activeMobilePanel === 'scorers' ? { background: 'rgba(255, 211, 42, 0.18)', borderColor: '#ffd32a', color: '#ffd32a', boxShadow: '0 0 14px rgba(255, 211, 42, 0.25)' } : {}) }}
              >🏆 Pichichi</button>
            </div>

            <div className="hide-on-desktop" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <div className={activeMobilePanel === 'thirds' ? '' : 'mobile-step-hidden'}>
                <BestThirdsPanel officialPoints={officialPoints} allGames={allGames} nameToIdMap={nameToIdMap} />
              </div>
              <div className={activeMobilePanel === 'live' ? '' : 'mobile-step-hidden'}>
                <LiveMatchesPanel liveMatches={matchRadar?.live || []} matchRadar={matchRadar} maxNext={1} />
              </div>
              <div className={activeMobilePanel === 'scorers' ? '' : 'mobile-step-hidden'}>
                <TopScorersPanel topScorers={topScorers} />
              </div>
            </div>
          </>
        )}

        {/* Paneles desktop (siempre visibles, solo en groups) */}
        {viewMode === 'groups' && (
          <div className="hide-on-mobile" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', marginBottom: '20px', width: '100%', gap: '20px' }}>
              <div style={{ flex: 1, minWidth: 'min(100%, 380px)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                  <BestThirdsPanel officialPoints={officialPoints} allGames={allGames} nameToIdMap={nameToIdMap} />
              </div>
              <div style={{ flex: 1, minWidth: 'min(100%, 350px)', maxWidth: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <LiveMatchesPanel liveMatches={matchRadar?.live || []} matchRadar={matchRadar} maxNext={1} />
              </div>
              <div style={{ flex: 1, minWidth: 'min(100%, 380px)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }} className="pichichi-mobile-center">
                  <TopScorersPanel topScorers={topScorers} />
              </div>
          </div>
        )}

        {viewMode === 'groups' ? (
          <>
            <div id="home-standings-grid" className="groups-grid">
              {Object.keys(groupOdds).map(groupName => renderGroup(groupName, groupOdds[groupName]))}
            </div>
            <GroupMatchesModal 
              selectedGroup={selectedGroup} 
              allGames={allGames} 
              onClose={() => setSelectedGroup(null)} 
            />
          </>
        ) : (
          <OfficialBracket hideTitle />
        )}

    </section>
  );
}

export default Home;
