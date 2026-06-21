import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { decodeHash } from '../utils/hash';
import { getCountryCode } from '../utils/constants';
import { compareTeams } from '../utils/points';

function BetViewer() {
  const state = useAppContext();
  const { viewerHash, setViewerHash, officialResultsHash, officialPoints, groupOdds, allGames, nameToIdMap } = state;
  const [openSection, setOpenSection] = useState('groups'); // 'groups' or 'knockout'
  const [pointsOpen, setPointsOpen] = useState(true);
  const [visibleRounds, setVisibleRounds] = useState({ r32: true, r16: true, qf: true, sf: false, center: false });

  const handleSectionChange = (section) => {
    if (openSection === section) {
      setOpenSection(null);
    } else {
      setOpenSection(section);
      if (section === 'knockout') {
        setPointsOpen(false);
      } else {
        setPointsOpen(true);
      }
    }
  };

  if (!viewerHash) return null;

  const part = decodeHash(viewerHash);
  if (!part) return null;

  let points = state.leaderboardData.find(lb => lb.hash === viewerHash) || { total: 0, r1: 0, r32: 0, r16: 0, qf: 0, sf: 0, finals: 0, scorer: 0, log: [], exactMatches: {}, passedTeams: {} };

  const getHtmlTeam = (name, isWinner = false) => {
    if (!name) return <div className="team-slot empty" style={{ pointerEvents: 'none', fontSize: '0.8rem', height: '32px', padding: '5px', justifyContent: 'center' }}>Por definir</div>;
    return (
      <div className={`team-slot ${isWinner ? 'winner' : ''}`} style={{ pointerEvents: 'none', fontSize: '0.8rem', height: '32px', padding: '5px 8px', display: 'flex', justifyContent: 'space-between' }}>
        <span>
          {!name.includes("º") && getCountryCode(name) !== "xx" && <img src={`https://flagcdn.com/16x12/${getCountryCode(name)}.png`} alt="" style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
          {name}
        </span>
        <span>{isWinner ? '✅' : ''}</span>
      </div>
    );
  };

  const renderRoundCol = (title, matchesArray, winnersList, isHidden) => {
    if (isHidden) return null;
    return (
      <div className="round" style={{ minWidth: '140px', margin: '0 10px' }}>
        <h2 style={{ fontSize: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', marginBottom: '10px' }}>{title}</h2>
        {matchesArray && matchesArray.map((m, i) => (
          <div key={i} className="match" style={{ marginBottom: '12px' }}>
            {getHtmlTeam(m[0], winnersList.includes(m[0]))}
            {getHtmlTeam(m[1], winnersList.includes(m[1]))}
          </div>
        ))}
      </div>
    );
  };

  const getFlat = (arr) => arr ? arr.flat().filter(Boolean) : [];
  const winR16 = getFlat(part.r16);
  const winQF = getFlat(part.qf);
  const winSF = getFlat(part.sf);
  const winFinal = part.final ? part.final : [];

  const r32Left = part.r32 ? part.r32.slice(0, 8) : [];
  const r32Right = part.r32 ? part.r32.slice(8, 16) : [];
  const r16Left = part.r16 ? part.r16.slice(0, 4) : [];
  const r16Right = part.r16 ? part.r16.slice(4, 8) : [];
  const qfLeft = part.qf ? part.qf.slice(0, 2) : [];
  const qfRight = part.qf ? part.qf.slice(2, 4) : [];
  const sfLeft = part.sf ? part.sf.slice(0, 1) : [];
  const sfRight = part.sf ? part.sf.slice(1, 2) : [];

  const getOfficialPositionAndMp = (groupName, teamName) => {
    if (!officialPoints || !officialPoints[groupName] || !groupOdds) return { pos: -1, mp: 0 };
    const teams = groupOdds[groupName].map(t => ({ name: t.name }));
    teams.sort((a, b) => compareTeams(a, b, groupName, officialPoints, allGames, nameToIdMap));
    const pos = teams.findIndex(t => t.name === teamName) + 1;
    
    const safeKey = teamName.replace(/[.#$\[\]]/g, "");
    const officialData = officialPoints[groupName][safeKey];
    const mp = (typeof officialData === 'object' && officialData !== null) ? (officialData.mp || 0) : 0;
    return { pos, mp };
  };

  const renderGroupTeam = (groupName, teamName, expectedPos, defaultColor, medal) => {
    let color = defaultColor;
    const { pos, mp } = getOfficialPositionAndMp(groupName, teamName);
    if (mp > 0) {
      const isExact = points.exactMatches && points.exactMatches[groupName] && points.exactMatches[groupName][expectedPos];
      const isPassed = points.passedTeams && points.passedTeams[teamName];
      
      if (isExact) {
        color = "#2ecc71"; // Green
      } else if (isPassed) {
        color = "#3498db"; // Blue
      } else {
        color = "#e74c3c"; // Red
      }
    }

    return (
      <div style={{ fontSize: '1em', color, marginBottom: '4px' }}>
        {medal} {!teamName.includes("º") && getCountryCode(teamName) !== "xx" && <img src={`https://flagcdn.com/16x12/${getCountryCode(teamName)}.png`} alt="" style={{ marginRight: '4px', verticalAlign: 'middle' }} />} {teamName}
      </div>
    );
  };

  const renderPointsLog = () => {
    const logs = points.log.filter(l => openSection === 'groups' ? l.stage === 'r1' : (l.stage !== 'r1' && l.stage !== 'scorer'));

    if (logs.length === 0) {
      return <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px' }}>No hay puntos en esta fase aún.</div>;
    }

    if (openSection === 'groups') {
      const grouped = {};
      logs.forEach(log => {
        const match = log.msg.match(/Grupo ([A-Z]):/);
        const groupName = match ? `Grupo ${match[1]}` : 'Otros';
        if (!grouped[groupName]) grouped[groupName] = { total: 0, items: [] };
        grouped[groupName].total += log.amount;
        const shortMsg = log.msg.replace(/Grupo [A-Z]: /, '');
        grouped[groupName].items.push({ ...log, shortMsg });
      });
      return (
        <div style={{ maxHeight: '80vh', overflowY: 'auto', paddingRight: '5px', marginBottom: '20px' }}>
          {Object.keys(grouped).sort().map(g => (
            <details key={g} {...(g === 'Grupo A' ? { open: true } : {})} style={{ background: 'rgba(255,255,255,0.05)', marginBottom: '5px', borderRadius: '5px', overflow: 'hidden' }}>
              <summary style={{ padding: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', userSelect: 'none', listStyle: 'none' }}>
                <span>{g}</span>
                <span style={{ fontSize: '0.85em', color: 'var(--accent-color)', background: 'rgba(0,210,211,0.15)', padding: '2px 8px', borderRadius: '10px' }}>+{grouped[g].total} pts</span>
              </summary>
              <div style={{ padding: '10px', paddingTop: 0 }}>
                {grouped[g].items.map((item, idx) => (
                   <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '8px 12px', marginBottom: '5px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginLeft: '10px' }}>
                      <span style={{ fontSize: '0.9em', color: 'var(--text-main)' }}>{item.shortMsg}</span>
                      <span style={{ color: '#fff', fontWeight: 'bold', background: 'rgba(0, 210, 211, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>+{item.amount}</span>
                   </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      );
    }

    return logs.map((log, index) => (
      <div key={index} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '8px', fontSize: '0.9em', display: 'flex', justifyContent: 'space-between' }}>
        <span>{log.msg}</span>
        <strong style={{ color: '#00d2d3' }}>+{log.amount} pts</strong>
      </div>
    ));
  };

  return (
    <div id="points-breakdown-modal" className="modal" style={{ display: 'flex', zIndex: 999999 }} onClick={() => setViewerHash(null)}>
      <div className="modal-content" style={{ width: '95vw', maxWidth: '1600px', textAlign: 'left', maxHeight: '95vh', overflowY: 'auto', paddingTop: '25px' }} onClick={e => e.stopPropagation()}>
        <div id="points-breakdown-body">
          
          {/* HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ color: 'var(--accent-color)', margin: 0 }}>Porra de {part.user}</h3>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              {part.scorer && <div style={{ background: 'rgba(255,159,67,0.15)', border: '1px solid rgba(255,159,67,0.3)', padding: '4px 10px', borderRadius: '8px', color: '#ff9f43', fontWeight: 'bold', fontSize: '0.9em' }}>⚽ Pichichi: {part.scorer}</div>}
              <div style={{ background: 'rgba(0,210,211,0.15)', border: '1px solid rgba(0,210,211,0.3)', padding: '4px 10px', borderRadius: '8px', color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '1.1em' }}>🏆 Total: {points.total} pts</div>
              <button onClick={() => setViewerHash(null)} className="glass-btn primary-btn" style={{ padding: '4px 15px', fontSize: '1rem', borderRadius: '8px' }}>Cerrar</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            
            {/* IZQUIERDA */}
            <div style={{ flex: 2, minWidth: '250px', maxHeight: '85vh', overflowY: 'auto', paddingRight: '10px' }}>
              {part.groups && (
                <details id="details-groups" open={openSection === 'groups'} style={{ marginBottom: '10px', maxWidth: '900px' }}>
                  <summary onClick={(e) => { e.preventDefault(); handleSectionChange('groups'); }} style={{ color: '#00d2d3', fontSize: '1.2em', cursor: 'pointer', fontWeight: 'bold', padding: '5px 0', userSelect: 'none' }}>Fase de Grupos</summary>
                  <div className="modal-groups-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginTop: '10px' }}>
                    {Object.keys(part.groups).map(g => (
                      <div key={g} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px', textAlign: 'left' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--accent-color)', marginBottom: '8px', fontSize: '1.1em', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>Grupo {g}</div>
                        {renderGroupTeam(g, part.groups[g][0], 1, "white", "🥇")}
                        {renderGroupTeam(g, part.groups[g][1], 2, "#ddd", "🥈")}
                        {part.thirds && part.thirds.includes(part.groups[g][2]) && renderGroupTeam(g, part.groups[g][2], 3, "#bbb", "🥉")}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <details id="details-knockout" open={openSection === 'knockout'} style={{ marginBottom: '20px' }}>
                <summary onClick={(e) => { e.preventDefault(); handleSectionChange('knockout'); }} style={{ color: '#00d2d3', fontSize: '1.2em', cursor: 'pointer', fontWeight: 'bold', padding: '5px 0', userSelect: 'none', marginBottom: '10px' }}>Eliminatorias</summary>
                
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '15px', justifyContent: 'center', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  <strong style={{ color: 'var(--text-muted)', fontSize: '0.9em', display: 'flex', alignItems: 'center' }}>Ocultar/Mostrar:</strong>
                  <button className="glass-btn" style={{ padding: '4px 10px', fontSize: '0.8rem', transition: 'all 0.2s ease', opacity: visibleRounds.r32 ? 1 : 0.5, filter: visibleRounds.r32 ? 'none' : 'grayscale(100%)', transform: visibleRounds.r32 ? 'none' : 'scale(0.95)' }} onClick={() => setVisibleRounds(prev => ({ ...prev, r32: !prev.r32 }))}>👁️ 1/16</button>
                  <button className="glass-btn" style={{ padding: '4px 10px', fontSize: '0.8rem', transition: 'all 0.2s ease', opacity: visibleRounds.r16 ? 1 : 0.5, filter: visibleRounds.r16 ? 'none' : 'grayscale(100%)', transform: visibleRounds.r16 ? 'none' : 'scale(0.95)' }} onClick={() => setVisibleRounds(prev => ({ ...prev, r16: !prev.r16 }))}>👁️ Octavos</button>
                  <button className="glass-btn" style={{ padding: '4px 10px', fontSize: '0.8rem', transition: 'all 0.2s ease', opacity: visibleRounds.qf ? 1 : 0.5, filter: visibleRounds.qf ? 'none' : 'grayscale(100%)', transform: visibleRounds.qf ? 'none' : 'scale(0.95)' }} onClick={() => setVisibleRounds(prev => ({ ...prev, qf: !prev.qf }))}>👁️ Cuartos</button>
                  <button className="glass-btn" style={{ padding: '4px 10px', fontSize: '0.8rem', transition: 'all 0.2s ease', opacity: visibleRounds.sf ? 1 : 0.5, filter: visibleRounds.sf ? 'none' : 'grayscale(100%)', transform: visibleRounds.sf ? 'none' : 'scale(0.95)' }} onClick={() => setVisibleRounds(prev => ({ ...prev, sf: !prev.sf }))}>👁️ Semis</button>
                  <button className="glass-btn" style={{ padding: '4px 10px', fontSize: '0.8rem', transition: 'all 0.2s ease', opacity: visibleRounds.center ? 1 : 0.5, filter: visibleRounds.center ? 'none' : 'grayscale(100%)', transform: visibleRounds.center ? 'none' : 'scale(0.95)' }} onClick={() => setVisibleRounds(prev => ({ ...prev, center: !prev.center }))}>👁️ Finales</button>
                </div>

                <div style={{ overflowX: 'auto', paddingBottom: '20px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', background: 'rgba(0,0,0,0.15)' }}>
                  <div className="bracket-wrapper" style={{ display: 'flex', justifyContent: 'center', minWidth: 'max-content', padding: '15px' }}>
                    <section className="bracket-side left-side" style={{ display: 'flex', gap: '10px' }}>
                      {renderRoundCol("Dieciseisavos", r32Left, winR16, !visibleRounds.r32)}
                      {renderRoundCol("Octavos", r16Left, winQF, !visibleRounds.r16)}
                      {renderRoundCol("Cuartos", qfLeft, winSF, !visibleRounds.qf)}
                      {renderRoundCol("Semifinales", sfLeft, winFinal, !visibleRounds.sf)}
                    </section>

                    <section className="center-side" style={{ display: visibleRounds.center ? 'flex' : 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '160px', gap: '20px', padding: '0 10px' }}>
                      <div className="finals-container" style={{ width: '100%' }}>
                        <div className="match final-match" style={{ marginBottom: '15px' }}>
                          <h3 style={{ textAlign: 'center', fontSize: '0.8rem', color: '#fbbf24', marginBottom: '5px' }}>🏆 FINAL 🏆</h3>
                          {getHtmlTeam(part.final ? part.final[0] : null, part.champion === (part.final ? part.final[0] : false))}
                          {getHtmlTeam(part.final ? part.final[1] : null, part.champion === (part.final ? part.final[1] : false))}
                        </div>
                        <div className="match champion-display" style={{ textAlign: 'center' }}>
                          <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>CAMPEÓN</h3>
                          <div className="team-slot winner" style={{ height: '50px', fontSize: '1.1rem', fontWeight: 'bold', justifyContent: 'center', pointerEvents: 'none', borderColor: '#fbbf24', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>
                            {part.champion ? (
                                <>
                                  {!part.champion.includes("º") && getCountryCode(part.champion) !== "xx" && <img src={`https://flagcdn.com/16x12/${getCountryCode(part.champion)}.png`} alt="" style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
                                  {part.champion}
                                </>
                            ) : '???'}
                          </div>
                        </div>
                        {part.thirdPlaceMatch && part.thirdPlaceMatch.length > 0 && (
                          <div className="match third-place" style={{ marginTop: '15px' }}>
                            <h3 style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>3º PUESTO</h3>
                            {getHtmlTeam(part.thirdPlaceMatch[0], part.thirdPlaceWinner === part.thirdPlaceMatch[0])}
                            {getHtmlTeam(part.thirdPlaceMatch[1], part.thirdPlaceWinner === part.thirdPlaceMatch[1])}
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="bracket-side right-side" style={{ display: 'flex', gap: '10px' }}>
                      {renderRoundCol("Semifinales", sfRight, winFinal, !visibleRounds.sf)}
                      {renderRoundCol("Cuartos", qfRight, winSF, !visibleRounds.qf)}
                      {renderRoundCol("Octavos", r16Right, winQF, !visibleRounds.r16)}
                      {renderRoundCol("Dieciseisavos", r32Right, winR16, !visibleRounds.r32)}
                    </section>
                  </div>
                </div>
              </details>
            </div>

            {/* DERECHA */}
            <div id="points-col-wrapper" style={{ flex: pointsOpen ? 1 : '0 0 auto', minWidth: pointsOpen ? '250px' : 'auto', transition: 'all 0.3s ease', maxHeight: '85vh', overflowY: 'auto' }}>
              <details id="details-points" open={pointsOpen} style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', boxSizing: 'border-box', overflow: 'hidden' }}>
                <summary onClick={(e) => { e.preventDefault(); setPointsOpen(!pointsOpen); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--accent-color)', fontSize: '1.1em', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none', paddingBottom: '5px', borderBottom: pointsOpen ? '1px solid rgba(255,255,255,0.1)' : 'none', listStyle: 'none' }}>
                  <span>Desglose de Puntos</span>
                  <span style={{ fontSize: '0.9em', fontWeight: 'normal', color: '#fff' }}>
                    Subtotal: <span style={{ color: 'var(--accent-color)' }}>{
                      points.log.filter(l => openSection === 'groups' ? l.stage === 'r1' : (l.stage !== 'r1' && l.stage !== 'scorer')).reduce((acc, l) => acc + l.amount, 0)
                    } pts</span>
                  </span>
                </summary>
                <div id="points-log-container" style={{ marginTop: '15px' }}>
                  {renderPointsLog()}
                </div>
              </details>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default BetViewer;
