import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { getCountryCode } from '../utils/constants';
import { compareTeams } from '../utils/points';
import BracketCanvas, { TeamSlot, matchTop, MATCH_H, COL_GAP } from './BracketCanvas';

function BetViewer() {
  const state = useAppContext();
  const { viewerBetId, setViewerBetId, officialResultsHash, officialPoints, groupOdds, allGames, nameToIdMap } = state;
  const [openSection, setOpenSection] = useState('groups'); // 'groups' or 'knockout'
  const [pointsOpen, setPointsOpen] = useState(true);
  const [visibleRounds, setVisibleRounds] = useState({ r32: true, r16: true, qf: true, sf: false, center: false });
  const [part, setPart] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!viewerBetId) {
      setPart(null);
      setError(null);
      return;
    }
    setError(null);
    setLoading(true);
    fetch(`/api/bets/${viewerBetId}`)
      .then(res => {
        if (!res.ok) return res.json().then(e => { throw new Error(e.error || "Error al cargar la apuesta"); });
        return res.json();
      })
      .then(data => {
        setPart(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [viewerBetId]);

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

  if (!viewerBetId) return null;

  if (loading) {
    return (
      <div id="points-breakdown-modal" className="modal" style={{ display: 'flex', zIndex: 999999 }} onClick={() => setViewerBetId(null)}>
        <div className="modal-content" style={{ width: '300px', textAlign: 'center', padding: '20px' }} onClick={e => e.stopPropagation()}>
          Cargando apuesta...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="points-breakdown-modal" className="modal" style={{ display: 'flex', zIndex: 999999 }} onClick={() => setViewerBetId(null)}>
        <div className="modal-content" style={{ width: '400px', textAlign: 'center', padding: '30px' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ color: '#ff4757', marginBottom: '15px' }}>Error al cargar la apuesta</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>{error}</p>
          <button className="glass-btn primary-btn" onClick={() => setViewerBetId(null)} style={{ padding: '8px 20px' }}>Cerrar</button>
        </div>
      </div>
    );
  }
  if (!part) return null;

  let points = state.leaderboardData.find(lb => lb.id === viewerBetId) || { total: 0, r1: 0, r32: 0, r16: 0, qf: 0, sf: 0, finals: 0, scorer: 0, log: [], exactMatches: {}, passedTeams: {} };

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



  const getFlat = (arr) => arr ? arr.flat().filter(Boolean) : [];
  const winR16 = getFlat(part.r16);
  const winQF = getFlat(part.qf);
  const winSF = getFlat(part.sf);
  const winFinal = part.final ? part.final : [];

  const toMatches = (arr) => (arr || []).map(m => ({ home: m?.[0] || null, away: m?.[1] || null }));

  const leftRounds = [
    toMatches(part.r32?.slice(0, 8)),
    toMatches(part.r16?.slice(0, 4)),
    toMatches(part.qf?.slice(0, 2)),
    toMatches(part.sf?.slice(0, 1)),
  ];
  const rightRounds = [
    toMatches(part.r32?.slice(8, 16)),
    toMatches(part.r16?.slice(4, 8)),
    toMatches(part.qf?.slice(2, 4)),
    toMatches(part.sf?.slice(1, 2)),
  ];

  const renderSlot = (name, { roundIndex }) => {
    let isWinner = false;
    if (name && name !== '???') {
      if (roundIndex === 0) isWinner = winR16.includes(name);
      else if (roundIndex === 1) isWinner = winQF.includes(name);
      else if (roundIndex === 2) isWinner = winSF.includes(name);
      else if (roundIndex === 3) isWinner = winFinal.includes(name);
      else if (roundIndex === 4) isWinner = part.champion === name;
      else if (roundIndex === 5) isWinner = part.thirdPlaceWinner === name;
    }
    
    return (
      <TeamSlot 
        name={name} 
        slotStyle={isWinner ? { borderLeft: '3px solid #2ecc71', background: 'rgba(46, 204, 113, 0.1)' } : {}}
        rightContent={isWinner ? <span style={{ marginLeft: '4px' }}>✅</span> : null}
      />
    );
  };

  const hiddenRounds = {
    0: !visibleRounds.r32,
    1: !visibleRounds.r16,
    2: !visibleRounds.qf,
    3: !visibleRounds.sf,
  };

  const finalTopY = matchTop(3, 0);

  const renderCenter = (colW) => (
    <div style={{ display: visibleRounds.center ? 'block' : 'none' }}>
      {/* FINAL */}
      <div style={{ position: 'absolute', top: finalTopY - 22, left: COL_GAP, width: colW, textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'rgba(251,191,36,0.9)', letterSpacing: 2, textTransform: 'uppercase' }}>
        🏆 Final 🏆
      </div>
      <div className="match final-match" style={{ position: 'absolute', top: finalTopY, left: COL_GAP, width: colW }}>
        {renderSlot(part.final?.[0], { roundIndex: 3 })}
        {renderSlot(part.final?.[1], { roundIndex: 3 })}
      </div>

      {/* CAMPEÓN */}
      <div style={{ position: 'absolute', top: finalTopY + MATCH_H + 18, left: COL_GAP, width: colW, textAlign: 'center' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--champion-gold)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>🏆 Campeón</div>
        <div className="champion-display">
          {renderSlot(part.champion, { roundIndex: 4 })}
        </div>
      </div>

      {/* TERCER PUESTO */}
      <div style={{ position: 'absolute', top: finalTopY + MATCH_H + 18 + MATCH_H + 44, left: COL_GAP, width: colW }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' }}>🥉 Tercer Puesto</div>
        <div className="match third-place">
          {renderSlot(part.thirdPlaceMatch?.[0], { roundIndex: 5 })}
          {renderSlot(part.thirdPlaceMatch?.[1], { roundIndex: 5 })}
        </div>
      </div>
    </div>
  );

  const getOfficialPositionAndMp = (groupName, teamName) => {
    if (!officialPoints || !officialPoints[groupName] || !groupOdds) return { pos: -1, mp: 0 };
    const teams = groupOdds[groupName].map(t => ({ name: t.name }));
    teams.sort((a, b) => compareTeams(a, b, groupName, officialPoints, allGames, nameToIdMap));
    const pos = teams.findIndex(t => t.name === teamName) + 1;
    
    const safeKey = teamName.replace(/[.#$\[\]]/g, "");
    const officialData = officialPoints[groupName][safeKey];
    const mp = (typeof officialData === 'object' && officialData !== null) ? (officialData.mp || 0) : 0;
    const status = (typeof officialData === 'object' && officialData !== null) ? (officialData.status || 0) : 0;
    return { pos, mp, status };
  };

  const renderGroupTeam = (groupName, teamName, expectedPos, defaultColor, medal) => {
    let color = defaultColor;
    const { pos, mp, status } = getOfficialPositionAndMp(groupName, teamName);
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
    
    let statusIcon = null;
    if (status >= 1 && status <= 4) statusIcon = <span title="Posición Matemática Fija" style={{marginLeft: '5px', fontSize: '0.85em', flexShrink: 0}}>📌</span>;

    return (
      <div style={{ fontSize: '1em', color, marginBottom: '4px' }}>
        {medal} {!teamName.includes("º") && getCountryCode(teamName) !== "xx" && <img src={`https://flagcdn.com/16x12/${getCountryCode(teamName)}.png`} alt="" style={{ marginRight: '4px', verticalAlign: 'middle' }} />} {teamName}{statusIcon}
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
    <div id="points-breakdown-modal" className="modal" style={{ display: 'flex', zIndex: 999999 }} onClick={() => setViewerBetId(null)}>
      <div className="modal-content" style={{ width: '95vw', maxWidth: '1600px', textAlign: 'left', maxHeight: '95vh', overflowY: 'auto', paddingTop: '25px' }} onClick={e => e.stopPropagation()}>
        <div id="points-breakdown-body">
          
          {/* HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ color: 'var(--accent-color)', margin: 0 }}>Porra de {part.user}</h3>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              {part.scorer && <div style={{ background: 'rgba(255,159,67,0.15)', border: '1px solid rgba(255,159,67,0.3)', padding: '4px 10px', borderRadius: '8px', color: '#ff9f43', fontWeight: 'bold', fontSize: '0.9em' }}>⚽ Pichichi: {part.scorer}</div>}
              <div style={{ background: 'rgba(0,210,211,0.15)', border: '1px solid rgba(0,210,211,0.3)', padding: '4px 10px', borderRadius: '8px', color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '1.1em' }}>🏆 Total: {points.total} pts</div>
              <button onClick={() => setViewerBetId(null)} className="glass-btn primary-btn" style={{ padding: '4px 15px', fontSize: '1rem', borderRadius: '8px' }}>Cerrar</button>
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
                  <BracketCanvas
                    leftRounds={leftRounds}
                    rightRounds={rightRounds}
                    renderSlot={renderSlot}
                    renderCenter={renderCenter}
                    hiddenRounds={hiddenRounds}
                  />
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
