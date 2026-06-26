import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { createBet, getAdminToken, fetchMyBets } from '../services/api';
import { useNavigate } from 'react-router-dom';
import GroupStage from '../components/GroupStage';
import BracketCanvas, { TeamSlot, matchTop, MATCH_H, COL_GAP } from '../components/BracketCanvas';

function Bracket() {
  const {
    bracketState, setBracketState,
    userName, setUserName,
    topScorer, setTopScorer,
    isAdminAuthenticated,
    activeGroupId, fetchData,
    groupOdds, activeGroupBetMode,
    officialPoints, activeGroupPichichi,
  } = useAppContext();

  const [betName, setBetName]               = useState('');
  const [myPreviousBets, setMyPreviousBets] = useState([]);
  const navigate = useNavigate();

  const isKnockoutsOnly = activeGroupBetMode === 'KNOCKOUTS_ONLY';
  const allTeams = groupOdds
    ? Object.values(groupOdds).flat().map(t => t.name).filter(Boolean)
    : [];

  // ── Auto-fill confirmed group winners ────────────────────────────────────
  useEffect(() => {
    if (!officialPoints || Object.keys(officialPoints).length === 0) return;
    if (!bracketState.r32.left[0]?.home?.name?.includes('º')) return;

    const firstPlace = {};
    Object.entries(officialPoints).forEach(([g, teams]) => {
      Object.entries(teams).forEach(([name, s]) => { if (s.status === 1) firstPlace[g] = name; });
    });
    Object.keys(firstPlace).forEach(g => {
      const orig = (groupOdds?.[g] || []).find(t => t.name.replace(/[.#$[\]]/g, '') === firstPlace[g]);
      if (orig) firstPlace[g] = orig.name;
    });
    if (!Object.keys(firstPlace).length) return;

    const ns = JSON.parse(JSON.stringify(bracketState));
    let changed = false;
    [...ns.r32.left, ...ns.r32.right].forEach(m => {
      if (m.home?.name?.startsWith('1º Grupo ')) {
        const g = m.home.name.replace('1º Grupo ', '');
        if (firstPlace[g]) { m.home = { name: firstPlace[g], id: m.home.id }; changed = true; }
      }
    });
    if (changed) setBracketState(ns);
  }, [officialPoints, groupOdds, bracketState, setBracketState]);

  // ── Redirect if no group ─────────────────────────────────────────────────
  useEffect(() => {
    if (!activeGroupId && !isAdminAuthenticated) {
      alert('Debes seleccionar o crear una liga antes de rellenar tu porra.');
      navigate('/mis-ligas');
    }
  }, [activeGroupId, navigate, isAdminAuthenticated]);

  // ── Fetch previous bets ──────────────────────────────────────────────────
  useEffect(() => {
    if (userName && activeGroupId) {
      fetchMyBets()
        .then(bets => setMyPreviousBets(bets.filter(b => b.groupId?.toString() !== activeGroupId?.toString())))
        .catch(console.error);
    }
  }, [userName, activeGroupId]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCopyBet = async (betId) => {
    if (!window.confirm('¿Quieres copiar esta porra y enviarla a la liga actual?')) return;
    try {
      const res = await fetch(`/api/bets/${betId}`);
      if (!res.ok) throw new Error();
      const betData = await res.json();
      betData.user = userName;
      await createBet(betData, activeGroupId);
      alert('¡Porra copiada con éxito a esta liga!');
      fetchData();
    } catch (e) { alert(e.message || 'Error copiando porra'); }
  };

  const setR32Team = (teamName, side, matchIndex, isHome) => {
    const ns = JSON.parse(JSON.stringify(bracketState));
    const m  = side === 'left' ? ns.r32.left[matchIndex] : ns.r32.right[matchIndex];
    if (isHome) m.home = { name: teamName, id: `${side}_${matchIndex}_home` };
    else        m.away = { name: teamName, id: `${side}_${matchIndex}_away` };
    setBracketState(ns);
  };

  const advanceTeam = (team, side, roundIndex, matchIndex) => {
    if (!team || team.name.includes('º')) return;
    const ns = JSON.parse(JSON.stringify(bracketState));

    if (roundIndex < 3) {
      const arr  = [ns.r16, ns.qf, ns.sf][roundIndex][side];
      const next = Math.floor(matchIndex / 2);
      if (matchIndex % 2 === 0) arr[next].home = team; else arr[next].away = team;
    } else if (roundIndex === 3) {
      if (!ns.final)           ns.final           = { home: null, away: null, id: 'FINAL' };
      if (!ns.thirdPlaceMatch) ns.thirdPlaceMatch = { home: null, away: null, id: 'THIRD' };
      const sf    = bracketState.sf[side][0];
      const loser = sf.home.name === team.name ? sf.away : sf.home;
      if (side === 'left') { ns.final.home = team; ns.thirdPlaceMatch.home = loser; }
      else                 { ns.final.away = team; ns.thirdPlaceMatch.away = loser; }
      ns.champion = null; ns.thirdPlaceWinner = null;
    } else if (roundIndex === 4) {
      ns.champion = team;
    } else if (roundIndex === 5) {
      ns.thirdPlaceWinner = team;
    }
    setBracketState(ns);
  };

  const getTeamPairs = (matches) =>
    matches.map(m => [
      m.home?.name && !m.home.name.includes('º') ? m.home.name : null,
      m.away?.name && !m.away.name.includes('º') ? m.away.name : null,
    ]);

  const handleGroupStageComplete = (selections, advancingThirds) => {
    const ns = JSON.parse(JSON.stringify(bracketState));
    const applySlot = (slot) => {
      if (!slot?.name?.includes('º Grupo')) return;
      const [pos, , group] = slot.name.split(' ');
      const sel = selections[group];
      if (sel) slot.name = pos === '1º' ? sel.first : sel.second;
    };
    const teamToGroup = {};
    Object.keys(selections).forEach(g => { if (selections[g].third) teamToGroup[selections[g].third] = g; });
    const sorted3rds = [...advancingThirds].sort((a, b) => teamToGroup[a].localeCompare(teamToGroup[b]));
    let ti = 0;
    const apply3rd = (slot) => {
      if (slot?.name?.startsWith('3º ') && ti < sorted3rds.length) slot.name = sorted3rds[ti++];
    };
    [...ns.r32.left, ...ns.r32.right].forEach(m => {
      applySlot(m.home); applySlot(m.away); apply3rd(m.home); apply3rd(m.away);
    });
    setBracketState(ns);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generateBetData = async () => {
    if (!betName.trim()) { alert('Por favor introduce un nombre para tu apuesta.'); return; }
    if (!isAdminAuthenticated && (!userName || !bracketState.champion)) {
      alert('Por favor rellena tu nombre y completa el bracket hasta el campeón.'); return;
    }
    if (activeGroupPichichi && !topScorer) { alert('Por favor introduce el pichichi.'); return; }
    if (isKnockoutsOnly) {
      const all = [...bracketState.r32.left, ...bracketState.r32.right];
      if (all.some(m => !m.home?.name || m.home.name.includes('º') || !m.away?.name || m.away.name.includes('º'))) {
        alert('Por favor rellena todos los equipos de los Dieciseisavos antes de enviar.'); return;
      }
    }
    const r32 = [...getTeamPairs(bracketState.r32.left), ...getTeamPairs(bracketState.r32.right)];
    const r16 = [...getTeamPairs(bracketState.r16.left), ...getTeamPairs(bracketState.r16.right)];
    const qf  = [...getTeamPairs(bracketState.qf.left),  ...getTeamPairs(bracketState.qf.right)];
    const sf  = [...getTeamPairs(bracketState.sf.left),  ...getTeamPairs(bracketState.sf.right)];
    const betData = {
      user: userName, bet: betName, r1: r32, r32, r16, qf, sf,
      final: bracketState.final?.home?.name && bracketState.final?.away?.name
        ? [bracketState.final.home.name, bracketState.final.away.name] : null,
      champion: bracketState.champion?.name || null,
      thirdPlaceMatch: bracketState.thirdPlaceMatch?.home?.name && bracketState.thirdPlaceMatch?.away?.name
        ? [bracketState.thirdPlaceMatch.home.name, bracketState.thirdPlaceMatch.away.name] : null,
      thirdPlaceWinner: bracketState.thirdPlaceWinner?.name || null,
      scorer: topScorer, isOfficial: isAdminAuthenticated,
    };
    try {
      if (isAdminAuthenticated) {
        const res = await fetch('/api/admin/official', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(betData) });
        alert(res.ok ? '¡Resultados OFICIALES actualizados!' : 'Error al actualizar resultados oficiales');
      } else {
        await createBet(betData, activeGroupId);
        alert('¡Apuesta enviada correctamente al servidor!');
        fetchData();
      }
    } catch (e) { alert(e.message || 'Hubo un error al enviar la apuesta.'); }
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  const isAuthenticated = !!getAdminToken();
  const hasPlaceholders = bracketState.r32.left[0]?.home?.name?.includes('º');
  const isInitialState  = !isKnockoutsOnly && hasPlaceholders && groupOdds && Object.keys(groupOdds).length > 0;

  /** Returns the status (1-4: pin, 5: blue dot) of a team across all groups */
  const getTeamStatus = (teamName) => {
    if (!teamName || !officialPoints || !groupOdds) return 0;
    for (const groupName of Object.keys(officialPoints)) {
      if (!groupOdds[groupName]) continue;
      const isInGroup = groupOdds[groupName].some(t => t.name === teamName);
      if (!isInGroup) continue;
      const safeKey = teamName.replace(/[.#$[\]]/g, '');
      const officialData = officialPoints[groupName][safeKey];
      if (typeof officialData === 'object' && officialData !== null) {
        return officialData.status || 0;
      }
    }
    return 0;
  };

  /** Slot renderer for BracketCanvas */
  const renderSlot = (team, { side, roundIndex, matchIndex, isHome }) => {
    // R32 in KNOCKOUTS_ONLY with placeholder → dropdown
    if (roundIndex === 0 && isKnockoutsOnly && team?.name?.includes('º')) {
      return (
        <select
          className="glass-input"
          style={{ width: '100%', height: 42, padding: '0 10px', fontSize: '0.85rem' }}
          defaultValue=""
          onChange={(e) => e.target.value && setR32Team(e.target.value, side, matchIndex, isHome)}
        >
          <option value="" disabled>Seleccionar...</option>
          {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      );
    }
    // R32: read-only display with status indicator
    if (roundIndex === 0) {
      let statusIndicator = null;
      const name = team?.name;
      if (name && !name.includes('º')) {
        const teamStatus = getTeamStatus(name);
        if (teamStatus >= 1 && teamStatus <= 4) {
          statusIndicator = (
            <span title="Posición Matemática Fija" style={{ marginLeft: '3px', fontSize: '0.75em', flexShrink: 0, lineHeight: 1 }}>📌</span>
          );
        } else if (teamStatus === 5) {
          statusIndicator = (
            <div title="Clasificado Matemáticamente" style={{ width: '6px', height: '6px', background: '#3498db', borderRadius: '50%', marginLeft: '4px', flexShrink: 0, boxShadow: '0 0 5px rgba(52,152,219,0.8)', display: 'inline-block' }} />
          );
        }
      }
      return <TeamSlot name={name} rightContent={statusIndicator} />;
    }
    // Other rounds: click to advance
    return <TeamSlot name={team?.name} onClick={() => advanceTeam(team, side, roundIndex, matchIndex)} />;
  };

  const finalTopY = matchTop(3, 0);

  const renderCenter = (colW) => (
    <>
      {/* FINAL */}
      <div style={{ position: 'absolute', top: finalTopY - 22, left: COL_GAP, width: colW, textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'rgba(251,191,36,0.9)', letterSpacing: 2, textTransform: 'uppercase' }}>
        ⚽ Final
      </div>
      <div className="match final-match" style={{ position: 'absolute', top: finalTopY, left: COL_GAP, width: colW }}>
        <TeamSlot name={bracketState.final?.home?.name} onClick={() => bracketState.final?.home && advanceTeam(bracketState.final.home, 'center', 4, 0)} />
        <TeamSlot name={bracketState.final?.away?.name} onClick={() => bracketState.final?.away && advanceTeam(bracketState.final.away, 'center', 4, 0)} />
      </div>

      {/* CAMPEÓN */}
      <div style={{ position: 'absolute', top: finalTopY + MATCH_H + 18, left: COL_GAP, width: colW, textAlign: 'center' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--champion-gold)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>🏆 Campeón</div>
        <div className="champion-display"><TeamSlot name={bracketState.champion?.name} /></div>
      </div>

      {/* TERCER PUESTO */}
      <div style={{ position: 'absolute', top: finalTopY + MATCH_H + 18 + MATCH_H + 44, left: COL_GAP, width: colW }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' }}>🥉 Tercer Puesto</div>
        <div className="match third-place">
          <TeamSlot name={bracketState.thirdPlaceMatch?.home?.name} onClick={() => bracketState.thirdPlaceMatch?.home && advanceTeam(bracketState.thirdPlaceMatch.home, 'center', 5, 0)} />
          <TeamSlot name={bracketState.thirdPlaceMatch?.away?.name} onClick={() => bracketState.thirdPlaceMatch?.away && advanceTeam(bracketState.thirdPlaceMatch.away, 'center', 5, 0)} />
        </div>
        {bracketState.thirdPlaceWinner && (
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4 }}>Ganador:</div>
            <TeamSlot name={bracketState.thirdPlaceWinner?.name} />
          </div>
        )}
      </div>
    </>
  );

  // ── JSX ──────────────────────────────────────────────────────────────────

  return (
    <section id="view-bracket" className="view-section" style={{ display: 'block' }}>

      {isInitialState ? (
        <>
          {myPreviousBets.length > 0 && (
            <div className="glass-panel" style={{ padding: 20, marginBottom: 30, maxWidth: 800, margin: '0 auto 20px auto', border: '1px solid #00d2d3' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#00d2d3', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>💡</span> ¿Quieres usar la misma predicción?
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 15 }}>
                Hemos visto que ya rellenaste tu porra en otra liga. Puedes copiarla directamente sin rellenar todo el cuadro de nuevo.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {myPreviousBets.map(b => (
                  <button key={b.key} onClick={() => handleCopyBet(b.id)} className="glass-btn primary-btn" style={{ background: 'rgba(0,210,211,0.2)', border: '1px solid #00d2d3' }}>
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
          <div className="section-header" style={{ marginBottom: 40, textAlign: 'center' }}>
            <h2 style={{ margin: 0 }}>Paso 2: Eliminatorias</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: '0.9rem' }}>
              Haz clic en un equipo para avanzarlo a la siguiente ronda
            </p>
          </div>

          <BracketCanvas
            leftRounds={[bracketState.r32.left, bracketState.r16.left, bracketState.qf.left, bracketState.sf.left]}
            rightRounds={[bracketState.r32.right, bracketState.r16.right, bracketState.qf.right, bracketState.sf.right]}
            renderSlot={renderSlot}
            renderCenter={renderCenter}
          />

          {/* Controls */}
          <div id="controls-section" style={{ marginTop: 30, padding: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--accent-color)' }}>Guardar Apuesta</h3>
            <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap', marginBottom: 15 }}>
              <input type="text" placeholder="Tu Nombre (Loguéate arriba primero)" value={userName} onChange={e => setUserName(e.target.value)} className="glass-input" style={{ flex: 1, minWidth: 200 }} disabled={isAuthenticated} />
              <input type="text" placeholder="Nombre Apuesta (ej: Apuesta 1)" value={betName} onChange={e => setBetName(e.target.value)} className="glass-input" style={{ flex: 1, minWidth: 200 }} />
              {activeGroupPichichi && (
                <input type="text" placeholder="Pichichi" value={topScorer} onChange={e => setTopScorer(e.target.value)} className="glass-input" style={{ flex: 1, minWidth: 200 }} />
              )}
            </div>
            <button className="glass-btn primary-btn" onClick={generateBetData}>Generar y Enviar Apuesta</button>
          </div>
        </>
      )}
    </section>
  );
}

export default Bracket;
