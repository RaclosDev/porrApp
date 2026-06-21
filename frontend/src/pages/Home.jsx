import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { getCountryCode } from '../utils/constants';
import { compareTeams } from '../utils/points';
import { openStats } from '../utils/navigation';
import { fetchTopScorers } from '../services/api';
import Flag from '../components/Flag';
import GroupMatchesModal from '../components/GroupMatchesModal';

function Home() {
  const { groupOdds, officialPoints, allGames, nameToIdMap, loading, isRaclos, matchRadar } = useAppContext();
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [topScorers, setTopScorers] = useState([]);

  useEffect(() => {
    fetchTopScorers().then(data => { if (data) setTopScorers(data); });
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando grupos...</div>;

  const liveMatches = matchRadar?.live || [];

  const renderLiveMatch = (m) => {
    const d = new Date(m.date);
    const dateFormatted = `${d.getDate()}/${d.getMonth()+1} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    const hasStarted = new Date() >= d;
    const hasFinished = m.finished === true;

    return (
      <div key={m.id} className="last-match-card">
        <div className="last-match-date">{hasStarted ? '🔴' : '⏳'} {dateFormatted}</div>
        <div className="last-match-teams" style={{ margin: 'auto 0' }}>
          <div className="last-match-team">
            <Flag team={m.home} />
            <span>{m.home}</span>
          </div>
          
          <div className="last-match-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {hasStarted ? (
                <span className="last-match-score">{m.homeScore} - {m.awayScore}</span>
            ) : (
                <span style={{ fontSize: '0.9em', color: 'var(--text-muted)', fontWeight: 'bold' }}>VS</span>
            )}
          </div>

          <div className="last-match-team away">
            <Flag team={m.away} />
            <span>{m.away}</span>
          </div>
        </div>
        
        <div style={{ textAlign: 'center' }}>
            <button onClick={() => openStats(m.home, m.away)} style={{ background: '#1e272e', color: '#00d2d3', border: '1px solid rgba(0,210,211,0.3)', padding: '6px 20px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              <span>📊</span> Ver Estadísticas
            </button>
        </div>
      </div>
    );
  };

  const renderGroup = (groupName, teams) => {
    // Map with stats
    const teamsWithStats = teams.map(t => {
      const safeKey = t.name.replace(/[.#$\[\]]/g, "");
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
          {teamsWithStats.map((team, idx) => (
            <div key={team.name} className="group-slot">
              <span style={{ fontWeight: 'bold', width: '20px', flexShrink: 0 }}>{idx + 1}.</span>
            <Flag team={team.name} size="16x12" style={{ marginRight: '8px' }} />
              <span style={{ flexGrow: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team.name}</span>
              <div style={{ display: 'flex', gap: '8px', fontSize: '0.85em', alignItems: 'center' }}>
                <span style={{ width: '20px', textAlign: 'center', color: team.stats.diff > 0 ? '#00b894' : team.stats.diff < 0 ? '#ff4757' : 'var(--text-muted)' }}>{team.stats.diff > 0 ? `+${team.stats.diff}` : team.stats.diff}</span>
                <span style={{ width: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>{team.stats.gls}</span>
                <span style={{ fontWeight: 'bold', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', color: 'white', width: '24px', textAlign: 'center' }}>{team.stats.pts}</span>
              </div>
            </div>
        ))}

      </div>
    );
  };

  return (
    <section id="view-home" className="view-section" style={{ display: 'block' }}>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', marginBottom: '20px', width: '100%', gap: '20px' }}>
            <div style={{ flex: 1, minWidth: 'min(100%, 320px)' }} className="hide-on-mobile">
                {(() => {
                    if (!officialPoints || Object.keys(officialPoints).length === 0) return null;
                    
                    const thirds = [];
                    Object.keys(officialPoints).forEach(groupName => {
                        const teamsWithStats = Object.keys(officialPoints[groupName]).map(teamName => ({
                            name: teamName,
                            ...officialPoints[groupName][teamName]
                        }));
                        
                        teamsWithStats.sort((a, b) => compareTeams(a, b, groupName, officialPoints, allGames, nameToIdMap));

                        if (teamsWithStats.length >= 3) {
                            thirds.push({ group: groupName, ...teamsWithStats[2] });
                        }
                    });

                    // Ordenar: Puntos (DESC), Diferencia (DESC), Goles a favor (DESC), Fair Play (DESC)
                    thirds.sort((a, b) => {
                        if (b.pts !== a.pts) return b.pts - a.pts;
                        if (b.diff !== a.diff) return b.diff - a.diff;
                        if (b.gls !== a.gls) return b.gls - a.gls;

                        const fpA = a.fp || 0;
                        const fpB = b.fp || 0;
                        if (fpB !== fpA) return fpB - fpA;

                        return a.name.localeCompare(b.name);
                    });

                    return (
                        <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '8px', margin: '0 auto' }}>
                            <div style={{ textAlign: 'center', color: '#00cec9', fontSize: '1rem', fontWeight: 'bold', padding: '6px', background: 'rgba(0, 206, 201, 0.1)', border: '1px solid rgba(0, 206, 201, 0.3)', borderRadius: '12px' }}>
                                🥉 MEJORES TERCEROS
                            </div>
                            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '10px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                    
                                    {/* Columna 1 (1-6) */}
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 25px 30px', gap: '6px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textAlign: 'center' }}>
                                            <span>#</span><span style={{ textAlign: 'left' }}>Equipo</span><span>PT</span><span>DF</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {thirds.slice(0, 6).map((t, idx) => {
                                                const globalIdx = idx;
                                                const isTop8 = globalIdx < 8;
                                                const rank = globalIdx + 1;
                                                
                                                return (
                                                    <div key={t.name} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 25px 30px', gap: '6px', padding: '5px 0', alignItems: 'center', fontSize: '0.85rem' }}>
                                                        <span style={{ color: isTop8 ? '#00b894' : 'var(--text-muted)', fontWeight: 'bold', textAlign: 'center' }}>{rank}</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                                            <Flag team={t.name} style={{ borderRadius: '2px', flexShrink: 0 }} />
                                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                                                        </div>
                                                        <span style={{ fontWeight: 'bold', textAlign: 'center', background: 'rgba(255,255,255,0.08)', borderRadius: '4px' }}>{t.pts}</span>
                                                        <span style={{ textAlign: 'center', color: t.diff > 0 ? '#00b894' : t.diff < 0 ? '#ff4757' : 'var(--text-muted)' }}>{t.diff > 0 ? `+${t.diff}` : t.diff}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Columna 2 (7-12) */}
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 25px 30px', gap: '6px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textAlign: 'center' }}>
                                            <span>#</span><span style={{ textAlign: 'left' }}>Equipo</span><span>PT</span><span>DF</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {thirds.slice(6, 12).map((t, idx) => {
                                                const globalIdx = idx + 6;
                                                const hasPlayed = t.mp > 0;
                                                const isTop8 = hasPlayed && globalIdx < 8;
                                                const rank = hasPlayed ? globalIdx + 1 : '-';
                                                
                                                return (
                                                    <div key={t.name} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 25px 30px', gap: '6px', padding: '5px 0', alignItems: 'center', fontSize: '0.85rem', borderBottom: globalIdx === 7 ? '2px dashed rgba(255, 71, 87, 0.5)' : 'none', opacity: isTop8 ? 1 : (hasPlayed ? 0.5 : 0.3) }}>
                                                        <span style={{ color: isTop8 ? '#00b894' : 'var(--text-muted)', fontWeight: 'bold', textAlign: 'center' }}>{rank}</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                                            <Flag team={t.name} style={{ borderRadius: '2px', flexShrink: 0 }} />
                                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                                                        </div>
                                                        <span style={{ fontWeight: 'bold', textAlign: 'center', background: 'rgba(255,255,255,0.08)', borderRadius: '4px' }}>{t.pts}</span>
                                                        <span style={{ textAlign: 'center', color: t.diff > 0 ? '#00b894' : t.diff < 0 ? '#ff4757' : 'var(--text-muted)' }}>{t.diff > 0 ? `+${t.diff}` : t.diff}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            <div style={{ flex: 1, minWidth: 'min(100%, 350px)', maxWidth: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="section-header" style={{ marginBottom: '15px', textAlign: 'center' }}>
                    <h2 style={{ margin: 0 }}>Clasificación Fase de Grupos</h2>
                </div>
                
                {liveMatches.length > 0 ? (() => {
                    const isActuallyLive = liveMatches.some(m => new Date(m.date) <= new Date());
                    return (
                        <div style={{ width: '100%', maxWidth: '480px', margin: '0 auto 20px auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ 
                                textAlign: 'center', 
                                color: isActuallyLive ? '#ff4757' : '#ffa502', 
                                fontSize: '1rem', 
                                fontWeight: 'bold', 
                                padding: '6px', 
                                background: isActuallyLive ? 'rgba(255, 71, 87, 0.1)' : 'rgba(255, 165, 2, 0.1)', 
                                border: isActuallyLive ? '1px solid rgba(255, 71, 87, 0.3)' : '1px solid rgba(255, 165, 2, 0.3)', 
                                borderRadius: '12px' 
                            }}>
                                {isActuallyLive ? '🔴 EN DIRECTO' : '⏳ A PUNTO DE COMENZAR'}
                            </div>
                            <div className="last-matches-grid" style={{ gridTemplateColumns: '1fr' }}>
                                {liveMatches.map(m => renderLiveMatch(m))}
                            </div>
                        </div>
                    );
                })() : (() => {
                    const next = (matchRadar?.next || [])[0];
                    if (!next) return null;
                    const d = new Date(next.date);
                    const dateFormatted = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                    return (
                        <div style={{ width: '100%', maxWidth: '480px', margin: '0 auto 20px auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ textAlign: 'center', color: '#a29bfe', fontSize: '1rem', fontWeight: 'bold', padding: '6px', background: 'rgba(162, 155, 254, 0.1)', border: '1px solid rgba(162, 155, 254, 0.3)', borderRadius: '12px' }}>
                                ⏳ PRÓXIMO PARTIDO
                            </div>
                            <div className="last-match-card">
                                <div className="last-match-date">🕒 {dateFormatted}</div>
                                <div className="last-match-teams" style={{ margin: 'auto 0' }}>
                                    <div className="last-match-team"><Flag team={next.home} /> <span>{next.home}</span></div>
                                    <div className="last-match-center"><span style={{ fontSize: '0.9em', color: 'var(--text-muted)', fontWeight: 'bold' }}>VS</span></div>
                                    <div className="last-match-team away"><Flag team={next.away} /> <span>{next.away}</span></div>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            <div style={{ flex: 1, minWidth: 'min(100%, 320px)', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', marginBottom: '20px' }} className="pichichi-mobile-center">
                <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ textAlign: 'center', color: '#ffd32a', fontSize: '1rem', fontWeight: 'bold', padding: '6px', background: 'rgba(255, 211, 42, 0.1)', border: '1px solid rgba(255, 211, 42, 0.3)', borderRadius: '12px' }}>
                        🏆 PICHICHI
                    </div>
                    {(() => {
                        if (!topScorers || topScorers.length === 0) {
                            return <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '0.9rem' }}>Cargando...</div>;
                        }
                        
                        // Encontrar la cantidad máxima de goles actual
                        const maxGoals = topScorers[0].goals;
                        // Contar cuántos jugadores tienen esa cantidad de goles (máximo 5 para no romper el diseño)
                        let pichichisCount = topScorers.filter(s => s.goals === maxGoals).length;
                        if (pichichisCount < 3) pichichisCount = 3; // Mostrar al menos 3 por estética
                        if (pichichisCount > 8) pichichisCount = 8; // Limitar a 8

                        // Alturas dinámicas basadas en las pruebas del widget de Sofascore
                        // Cada fila extra añade aproximadamente 48px
                        // baseHeight ajustado para evitar cortar al último jugador por abajo
                        const baseHeight = 168; 
                        const calculatedHeight = baseHeight + ((pichichisCount - 3) * 48);

                        return (
                            <div className="sofascore-widget-container" style={{ overflow: 'hidden', position: 'relative', height: `${calculatedHeight}px`, borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', transition: 'height 0.3s ease' }}>
                                <iframe 
                                    id={`sofa-standings-embed-16-58210-${pichichisCount}`} 
                                    src={`https://widgets.sofascore.com/es-ES/embed/unique-tournament/16/season/58210/topPlayers?numberOfTopPlayers=${pichichisCount}&showCompetitionLogo=true&widgetTitle=Pichichi&widgetTheme=dark&sortBy=goals&seasonPeriodType=overall`} 
                                    frameBorder="0" 
                                    scrolling="no" 
                                    // top: -116px oculta el título principal y la cabecera interior (#, Jugador, Goles)
                                    // left: -48px oculta la columna numérica y aprieta la foto hacia la izquierda
                                    // width: calc(100% + 60px) expande a la derecha para recortar el padding interno sobrante
                                    style={{ width: 'calc(100% + 60px)', height: `${calculatedHeight + 265}px`, maxWidth: 'none', position: 'absolute', top: '-116px', left: '-48px' }}>
                                </iframe>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>

        <div id="home-standings-grid" className="groups-grid">
          {Object.keys(groupOdds).map(groupName => renderGroup(groupName, groupOdds[groupName]))}
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
