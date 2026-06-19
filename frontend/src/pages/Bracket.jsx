import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { getCountryCode } from '../utils/constants';
import { encodeHash } from '../utils/hash';
import { createBet, getAdminToken, fetchMyBets } from '../services/api';
import { decodeHash } from '../utils/hash';

import GroupStage from '../components/GroupStage';

function Bracket() {
  const { bracketState, setBracketState, userName, setUserName, topScorer, setTopScorer, isAdminAuthenticated, activeGroupId, fetchData, groupOdds } = useAppContext();
  const [betName, setBetName] = useState('Mi Apuesta');
  const [generatedHash, setGeneratedHash] = useState('');
  const [myPreviousBets, setMyPreviousBets] = useState([]);

  useEffect(() => {
    if (userName) {
      fetchMyBets().then(bets => {
        // Filter out bets from the current group, we only want to offer copying from OTHER groups
        const otherBets = bets.filter(b => b.groupId?.toString() !== activeGroupId?.toString());
        setMyPreviousBets(otherBets);
      }).catch(e => console.error(e));
    }
  }, [userName, activeGroupId]);

  const handleCopyBet = (hash) => {
    const decoded = decodeHash(hash);
    if (!decoded) return;
    
    // We would need a full recreate from hash logic here, but for now we just encode and save directly 
    // or populate the bracket visually. Actually, reconstructing the bracket visually is complex, 
    // but we can just use the hash and submit it for the current group!
    if (window.confirm(`¿Quieres copiar esta porra y enviarla a la liga actual?`)) {
      createBet(userName, hash, activeGroupId).then(() => {
        alert("¡Porra copiada con éxito a esta liga!");
        fetchData();
      }).catch(e => alert("Error copiando porra"));
    }
  };

  const isAuthenticated = !!getAdminToken();

  const advanceTeam = (team, side, roundIndex, matchIndex) => {
    if (!team || team.name.includes("º")) return;

    const newState = JSON.parse(JSON.stringify(bracketState));

    let nextRoundArray = null;
    if (roundIndex === 0) nextRoundArray = newState.r16[side];
    else if (roundIndex === 1) nextRoundArray = newState.qf[side];
    else if (roundIndex === 2) nextRoundArray = newState.sf[side];

    if (roundIndex < 3) {
      const nextMatchIdx = Math.floor(matchIndex / 2);
      const isHome = matchIndex % 2 === 0;

      if (isHome) nextRoundArray[nextMatchIdx].home = team;
      else nextRoundArray[nextMatchIdx].away = team;

    } else if (roundIndex === 3) {
      if (!newState.final) newState.final = { home: null, away: null, id: "FINAL" };
      if (!newState.thirdPlaceMatch) newState.thirdPlaceMatch = { home: null, away: null, id: "THIRD" };

      const loserTeam = bracketState.sf[side][0].home.name === team.name ? bracketState.sf[side][0].away : bracketState.sf[side][0].home;

      if (side === 'left') {
        newState.final.home = team;
        newState.thirdPlaceMatch.home = loserTeam;
      } else {
        newState.final.away = team;
        newState.thirdPlaceMatch.away = loserTeam;
      }

      newState.champion = null;
      newState.thirdPlaceWinner = null;
    } else if (roundIndex === 4) {
      newState.champion = team;
    } else if (roundIndex === 5) {
      newState.thirdPlaceWinner = team;
    }

    setBracketState(newState);
  };

  const getArrayOfTeams = (matches) => {
    let arr = [];
    matches.forEach(m => {
      if (m.home && m.home.name && !m.home.name.includes("º")) arr.push(m.home.name);
      if (m.away && m.away.name && !m.away.name.includes("º")) arr.push(m.away.name);
    });
    return arr;
  };

  const handleGroupStageComplete = (selections, advancingThirds) => {
    const newState = JSON.parse(JSON.stringify(bracketState));

    const applyToSlot = (slot) => {
      if (!slot) return;
      if (slot.name && slot.name.includes("º Grupo")) {
        const parts = slot.name.split(" ");
        const pos = parts[0]; 
        const group = parts[2]; 
        const sel = selections[group];
        if (sel) {
           slot.name = pos === "1º" ? sel.first : sel.second;
        }
      }
    };

    const teamToGroup = {};
    Object.keys(selections).forEach(g => {
      if (selections[g].third) {
        teamToGroup[selections[g].third] = g;
      }
    });

    const sortedAdvancingThirds = [...advancingThirds].sort((a, b) => {
       return teamToGroup[a].localeCompare(teamToGroup[b]);
    });

    let thirdIndex = 0;
    const applyThirds = (slot) => {
      if (!slot) return;
      if (slot.name && slot.name.startsWith("3º ")) {
        if (thirdIndex < sortedAdvancingThirds.length) {
          slot.name = sortedAdvancingThirds[thirdIndex];
          thirdIndex++;
        }
      }
    };

    newState.r32.left.forEach(m => {
      applyToSlot(m.home);
      applyToSlot(m.away);
      applyThirds(m.home);
      applyThirds(m.away);
    });

    newState.r32.right.forEach(m => {
      applyToSlot(m.home);
      applyToSlot(m.away);
      applyThirds(m.home);
      applyThirds(m.away);
    });

    setBracketState(newState);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generateBetData = async () => {
    if (!isAdminAuthenticated && (!userName || !topScorer || !bracketState.champion)) {
      alert("Por favor rellena tu nombre, pichichi y completa el bracket hasta el campeón.");
      return;
    }

    const r32 = [...getArrayOfTeams(bracketState.r32.left), ...getArrayOfTeams(bracketState.r32.right)];
    const r16 = [...getArrayOfTeams(bracketState.r16.left), ...getArrayOfTeams(bracketState.r16.right)];
    const qf = [...getArrayOfTeams(bracketState.qf.left), ...getArrayOfTeams(bracketState.qf.right)];
    const sf = [...getArrayOfTeams(bracketState.sf.left), ...getArrayOfTeams(bracketState.sf.right)];
    
    const finals = [];
    if (bracketState.champion) finals.push(bracketState.champion.name);
    
    if (bracketState.final?.home && bracketState.final?.away && bracketState.champion) {
      const runnerUp = bracketState.final.home.name === bracketState.champion.name ? bracketState.final.away.name : bracketState.final.home.name;
      finals.push(runnerUp);
    }

    if (bracketState.thirdPlaceWinner) finals.push(bracketState.thirdPlaceWinner.name);
    if (bracketState.thirdPlaceMatch?.home && bracketState.thirdPlaceMatch?.away && bracketState.thirdPlaceWinner) {
        const fourth = bracketState.thirdPlaceMatch.home.name === bracketState.thirdPlaceWinner.name ? bracketState.thirdPlaceMatch.away.name : bracketState.thirdPlaceMatch.home.name;
        if (fourth) finals.push(fourth);
    }

    const betData = {
      user: userName,
      bet: betName,
      r1: r32,
      r32: r32,
      r16: r16,
      qf: qf,
      sf: sf,
      finals: finals,
      scorer: topScorer,
      isOfficial: isAdminAuthenticated
    };

    const hash = encodeHash(betData);
    setGeneratedHash(hash);

    try {
      if (isAdminAuthenticated) {
        const res = await fetch(`/api/admin/official`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hash: hash })
        });
        if (res.ok) {
          alert("¡Resultados OFICIALES actualizados en la nube con éxito!");
        } else {
          alert("Error al actualizar resultados oficiales");
        }
      } else {
        await createBet(userName, hash, activeGroupId);
        alert("¡Apuesta enviada correctamente al servidor!");
        fetchData();
      }
    } catch (e) {
      console.error(e);
      alert("El código se generó pero hubo un error al enviarlo. Puedes copiar el código y dárselo al admin.");
    }
  };

  const renderTeamSlot = (team, onclickFn) => {
    if (!team) return <div className="team-slot empty">Por definir</div>;
    const flagHtml = team.name.includes("º") ? null : <img src={`https://flagcdn.com/16x12/${getCountryCode(team.name)}.png`} alt="" />;
    return (
      <div className="team-slot" onClick={onclickFn} style={{ cursor: 'pointer' }}>
        {flagHtml}
        <span>{team.name}</span>
      </div>
    );
  };

  const renderRoundCol = (matches, side, roundIndex) => (
    matches.map((m, idx) => (
      <div key={m.id} className="match">
        {renderTeamSlot(m.home, () => advanceTeam(m.home, side, roundIndex, idx))}
        {renderTeamSlot(m.away, () => advanceTeam(m.away, side, roundIndex, idx))}
      </div>
    ))
  );

  const isInitialState = bracketState.r32.left[0]?.home?.name?.includes("º");

  return (
    <section id="view-bracket" className="view-section" style={{ display: 'block' }}>
      
      {isInitialState && groupOdds && Object.keys(groupOdds).length > 0 ? (
        <>
          {myPreviousBets.length > 0 && (
            <div className="glass-panel" style={{ padding: '20px', marginBottom: '30px', maxWidth: '800px', margin: '0 auto 20px auto', border: '1px solid #00d2d3' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#00d2d3', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>💡</span> ¿Quieres usar la misma predicción?
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '15px' }}>
                Hemos visto que ya rellenaste tu porra en otra liga. Puedes copiarla directamente sin rellenar todo el cuadro de nuevo.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {myPreviousBets.map(b => (
                  <button 
                    key={b.key} 
                    onClick={() => handleCopyBet(b.hash)}
                    className="glass-btn primary-btn"
                    style={{ background: 'rgba(0, 210, 211, 0.2)', border: '1px solid #00d2d3' }}
                  >
                    Copiar "{b.betName}"
                  </button>
                ))}
              </div>
            </div>
          )}
          <GroupStage groupOdds={groupOdds} onComplete={handleGroupStageComplete} activeGroupId={activeGroupId} />
        </>
      ) : (
        <>
          <div className="section-header" style={{ marginBottom: '20px', textAlign: 'center' }}>
              <h2 style={{ margin: 0 }}>Paso 2: Eliminatorias</h2>
          </div>

          <div style={{ overflowX: 'auto', width: '100%', paddingBottom: '20px' }}>
        <div className="bracket-wrapper" style={{ display: 'flex', justifyContent: 'center', minWidth: 'max-content', padding: '15px' }}>
            <section className="bracket-side left-side">
                {bracketState.r32.left.length > 0 && (
                    <div className="round r32">
                        <h2>Dieciseisavos</h2>
                        {renderRoundCol(bracketState.r32.left, 'left', 0)}
                    </div>
                )}
                <div className="round r16">
                    <h2>Octavos</h2>
                    {renderRoundCol(bracketState.r16.left, 'left', 1)}
                </div>
                <div className="round qf">
                    <h2>Cuartos</h2>
                    {renderRoundCol(bracketState.qf.left, 'left', 2)}
                </div>
                <div className="round sf">
                    <h2>Semifinales</h2>
                    {renderRoundCol(bracketState.sf.left, 'left', 3)}
                </div>
            </section>
            <section className="center-side">
                <div className="finals-container">
                    <div className="match final-match">
                        <h3>FINAL</h3>
                        {bracketState.final ? (
                            <>
                            {renderTeamSlot(bracketState.final.home, () => advanceTeam(bracketState.final.home, 'center', 4, 0))}
                            {renderTeamSlot(bracketState.final.away, () => advanceTeam(bracketState.final.away, 'center', 4, 0))}
                            </>
                        ) : (
                            <>
                            {renderTeamSlot(null)}
                            {renderTeamSlot(null)}
                            </>
                        )}
                    </div>
                    <div className="match champion-display">
                        <h3>CAMPEÓN</h3>
                        {renderTeamSlot(bracketState.champion, null)}
                    </div>
                    <div className="match third-place">
                        <h3>TERCER PUESTO</h3>
                        {bracketState.thirdPlaceMatch ? (
                            <>
                            {renderTeamSlot(bracketState.thirdPlaceMatch.home, () => advanceTeam(bracketState.thirdPlaceMatch.home, 'center', 5, 0))}
                            {renderTeamSlot(bracketState.thirdPlaceMatch.away, () => advanceTeam(bracketState.thirdPlaceMatch.away, 'center', 5, 0))}
                            </>
                        ) : (
                            <>
                            {renderTeamSlot(null)}
                            {renderTeamSlot(null)}
                            </>
                        )}
                        {bracketState.thirdPlaceWinner && (
                            <div style={{ marginTop: '10px' }}>
                                <strong>Ganador:</strong> {renderTeamSlot(bracketState.thirdPlaceWinner, null)}
                            </div>
                        )}
                    </div>
                </div>
            </section>
            <section className="bracket-side right-side">
                <div className="round sf">
                    <h2>Semifinales</h2>
                    {renderRoundCol(bracketState.sf.right, 'right', 3)}
                </div>
                <div className="round qf">
                    <h2>Cuartos</h2>
                    {renderRoundCol(bracketState.qf.right, 'right', 2)}
                </div>
                <div className="round r16">
                    <h2>Octavos</h2>
                    {renderRoundCol(bracketState.r16.right, 'right', 1)}
                </div>
                {bracketState.r32.right.length > 0 && (
                    <div className="round r32">
                        <h2>Dieciseisavos</h2>
                        {renderRoundCol(bracketState.r32.right, 'right', 0)}
                    </div>
                )}
            </section>
        </div>
      </div>

      <div id="controls-section" style={{ marginTop: '30px', padding: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>

        <h3 style={{ marginTop: 0, color: 'var(--accent-color)' }}>Guardar Apuesta</h3>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '15px' }}>
            <input 
              type="text" 
              placeholder="Tu Nombre (Loguéate arriba primero)" 
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="glass-input" 
              style={{ flex: 1, minWidth: '200px' }} 
              disabled={isAuthenticated}
            />
            <input 
              type="text" 
              placeholder="Nombre Apuesta (ej: Apuesta 1)" 
              value={betName}
              onChange={(e) => setBetName(e.target.value)}
              className="glass-input" 
              style={{ flex: 1, minWidth: '200px' }} 
            />
            <input 
              type="text" 
              placeholder="Pichichi" 
              value={topScorer}
              onChange={(e) => setTopScorer(e.target.value)}
              className="glass-input" 
              style={{ flex: 1, minWidth: '200px' }} 
            />
        </div>
        <button className="glass-btn primary-btn" onClick={generateBetData}>
            Generar y Enviar Apuesta
        </button>
        {generatedHash && (
          <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(0,255,0,0.1)', border: '1px solid #4cd137', borderRadius: '5px', wordBreak: 'break-all', fontSize: '0.9em' }}>
              <strong>Código Generado:</strong><br/>
              {generatedHash}
          </div>
        )}
      </div>
      </>
      )}
    </section>
  );
}

export default Bracket;
