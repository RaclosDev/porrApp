import { useAppContext } from '../context/AppContext';
import { decodeHash } from '../utils/hash';
import html2canvas from 'html2canvas';
import { useState } from 'react';

import { acceptGroupBet, deleteGroupBet } from '../services/api';

function Leaderboard() {
  const state = useAppContext();
  const { leaderboardData, loading, isRaclos, activeGroupName, activeGroupId, activeGroupAdmin, userName } = state;
  const [sharing, setSharing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const isLeagueAdmin = activeGroupAdmin === userName;

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando clasificación...</div>;

  // Combine backend leaderboard data with frontend hashes for UI state (e.g., editing names)
  const results = leaderboardData.map(backendScore => {
      const hashObj = state.participantsHashes.find(h => h.hash === backendScore.hash) || {};
      const part = decodeHash(backendScore.hash);
      return {
          key: backendScore.id,
          hash: backendScore.hash,
          name: backendScore.name || part?.user || 'Anónimo',
          betName: part?.bet || '',
          points: backendScore,
          paid: !backendScore.pending,
          part: part
      };
  }).filter(r => r.part);

  results.sort((a, b) => {
    if (a.paid !== b.paid) return a.paid ? -1 : 1;
    return b.points.total - a.points.total;
  });

  let currentRank = 1;
  let previousPoints = -1;

  results.forEach((r) => {
    if (r.paid) {
      if (previousPoints !== -1 && r.points.total < previousPoints) {
        currentRank++;
      }
      r.rank = currentRank;
      previousPoints = r.points.total;
    } else {
      r.rank = '-';
    }
  });

  let lowestPaidRank = 1;
  results.forEach(r => {
    if (r.paid && typeof r.rank === 'number' && r.rank > lowestPaidRank) {
      lowestPaidRank = r.rank;
    }
  });

  const handleShare = async () => {
    setSharing(true);
    try {
      const template = document.getElementById('share-image-template');
      const canvas = await html2canvas(template, {
        backgroundColor: '#0f0f1a',
        scale: 2,
        logging: false,
        useCORS: true
      });
      const imgData = canvas.toDataURL('image/png');
      const fetchRes = await fetch(imgData);
      const blob = await fetchRes.blob();
      const file = new File([blob], 'Clasificacion_Porra.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const link = document.createElement('a');
        link.download = 'Clasificacion_Porra_Mundial.png';
        link.href = imgData;
        link.click();
      }
    } catch (e) {
      console.error(e);
      alert("Error al generar la imagen para compartir");
    } finally {
      setSharing(false);
    }
  };

  const handleAcceptBet = async (betId) => {
    if (!window.confirm("¿Confirmar que este jugador ha pagado / es aceptado en la liga?")) return;
    setActionLoading(true);
    try {
      await acceptGroupBet(activeGroupId, betId);
      state.fetchData();
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBet = async (betId) => {
    if (!window.confirm("¿Estás seguro de ELIMINAR esta porra? Esta acción no se puede deshacer.")) return;
    setActionLoading(true);
    try {
      await deleteGroupBet(activeGroupId, betId);
      state.fetchData();
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const validResults = results.filter(r => r.paid);
  const mid = Math.ceil(validResults.length / 2);

  return (
    <section id="view-leaderboard" className="view-section" style={{ display: 'block' }}>
        <div className="section-header" style={{ marginBottom: '20px', textAlign: 'center' }}>
            <h2 style={{ margin: 0 }}>Clasificación: <span className="text-blue-400">{activeGroupName}</span></h2>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '15px' }}>
                <button id="btn-share-wa" onClick={handleShare} disabled={sharing} className="glass-btn primary-btn" style={{ padding: '8px 20px', fontSize: '1.1em', display: 'flex', alignItems: 'center', gap: '8px', background: '#25D366', color: 'white', borderColor: '#25D366', borderRadius: '20px', cursor: sharing ? 'not-allowed' : 'pointer' }}>
                    <span>{sharing ? 'Generando...' : 'Compartir en WhatsApp'}</span> 📱
                </button>
            </div>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
            <div className="table-container" style={{ flex: 1, minWidth: '300px', maxWidth: '1400px', margin: '0 auto' }}>
                <table className="leaderboard-table">
                    <thead>
                        <tr>
                            <th>Pos</th>
                            <th>Participante</th>
                            <th>TOTAL</th>
                            <th>F.Grupos</th>
                            <th>1/16</th>
                            <th>Octavos</th>
                            <th>Cuartos</th>
                            <th>Semis</th>
                            <th>Finales</th>
                            <th>Pichichi</th>
                        </tr>
                    </thead>
                    <tbody id="leaderboard-body-tab">
                        {results.map(r => {
                            let rankDisplay = r.rank;
                            if (r.paid) {
                                if (r.rank === 1) rankDisplay = "🥇";
                                else if (r.rank === 2) rankDisplay = "🥈";
                                else if (r.rank === 3) rankDisplay = "🥉";
                                else if (r.rank === lowestPaidRank && lowestPaidRank > 3) rankDisplay = "🐢";
                            }

                            const isPending = !r.paid;
                            const rowStyle = { backgroundColor: isPending ? 'rgba(255, 165, 0, 0.05)' : 'transparent', cursor: 'pointer' };

                            return (
                                <tr key={r.key} style={rowStyle}>
                                    <td style={{ fontSize: '1.2em', textAlign: 'center' }}>{rankDisplay}</td>
                                    <td>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <span title={`Ver Apuesta de ${r.name}`} style={{ fontSize: '1.1em' }}><strong>{r.name}</strong></span>
                                                    {isPending && <span style={{ fontSize: '10px', background: 'orange', color: 'white', padding: '2px 4px', borderRadius: '4px', marginLeft: '8px' }}>⏳ Pendiente</span>}
                                                </div>
                                                <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>{r.betName}</div>
                                            </div>
                                            
                                            {/* View Button (Available for everyone) */}
                                            <button className="glass-btn" onClick={(e) => { e.stopPropagation(); state.setViewerHash(r.hash); }} style={{ background: 'rgba(56, 173, 246, 0.2)', color: '#38adf6', border: '1px solid #38adf6', padding: '4px 8px', fontSize: '0.8rem', whiteSpace: 'nowrap' }} title="Ver Apuesta">
                                                👁️ Ver Porra
                                            </button>
                                        </div>
                                        
                                        {/* Admin Action Buttons Container */}
                                        {(isLeagueAdmin || isRaclos) && (
                                            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                {isPending && (
                                                    <button className="glass-btn" disabled={actionLoading} onClick={(e) => { e.stopPropagation(); handleAcceptBet(r.key); }} style={{ background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', border: '1px solid #2ecc71', padding: '4px 8px', fontSize: '0.8rem', cursor: actionLoading ? 'wait' : 'pointer' }} title="Aceptar Apuesta (Pagado)">
                                                        ✔️ Aceptar
                                                    </button>
                                                )}
                                                
                                                <button className="glass-btn" disabled={actionLoading} onClick={(e) => { e.stopPropagation(); handleDeleteBet(r.key); }} style={{ background: 'rgba(255, 71, 87, 0.2)', color: '#ff4757', border: '1px solid #ff4757', padding: '4px 8px', fontSize: '0.8rem', cursor: actionLoading ? 'wait' : 'pointer' }} title="Borrar Apuesta">
                                                    🗑️ Borrar
                                                </button>

                                                {isRaclos && (
                                                    <button className="glass-btn" onClick={(e) => { e.stopPropagation(); state.editBetName(r.key, r.hash); }} style={{ background: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', border: '1px solid #fbbf24', padding: '4px 8px', fontSize: '0.8rem' }} title="Editar Nombre">
                                                        ✏️ Editar
                                                    </button>
                                                )}
                                                
                                                {isRaclos && r.paid && r.part && r.part.thirdPlaceMatch && r.part.thirdPlaceMatch.length === 2 && !r.part.thirdPlaceWinner && (
                                                    <>
                                                        <button className="glass-btn" onClick={(e) => { e.stopPropagation(); state.fixThird(r.key, r.hash, r.part.thirdPlaceMatch[0]); }} style={{ background: 'rgba(0, 210, 211, 0.2)', color: '#00d2d3', border: '1px solid #00d2d3', padding: '4px 8px', fontSize: '0.8rem' }}>3º: {r.part.thirdPlaceMatch[0]}</button>
                                                        <button className="glass-btn" onClick={(e) => { e.stopPropagation(); state.fixThird(r.key, r.hash, r.part.thirdPlaceMatch[1]); }} style={{ background: 'rgba(0, 210, 211, 0.2)', color: '#00d2d3', border: '1px solid #00d2d3', padding: '4px 8px', fontSize: '0.8rem' }}>3º: {r.part.thirdPlaceMatch[1]}</button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '1.1em', textAlign: 'center' }}>
                                        {r.paid ? r.points.total + ' pts' : '-'}
                                    </td>
                                    <td>{r.paid ? r.points.r1 : '-'}</td>
                                    <td>{r.paid ? r.points.r32 : '-'}</td>
                                    <td>{r.paid ? r.points.r16 : '-'}</td>
                                    <td>{r.paid ? r.points.qf : '-'}</td>
                                    <td>{r.paid ? r.points.sf : '-'}</td>
                                    <td>{r.paid ? r.points.finals : '-'}</td>
                                    <td>{r.paid ? r.points.scorer : '-'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>

        {/* SHARE IMAGE TEMPLATE (Hidden) */}
        <div id="share-image-template" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', padding: '30px', background: '#0f0f1a', color: 'white', fontFamily: "'Outfit', sans-serif", boxSizing: 'border-box', borderRadius: '15px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #00d2d3', paddingBottom: '10px' }}>
                <h1 style={{ color: '#00d2d3', margin: 0, fontSize: '28px', textTransform: 'uppercase' }}>🏆 Porra Mundial 2026</h1>
                <p style={{ color: '#ff9f43', margin: '5px 0 0 0', fontSize: '18px', fontWeight: 'bold' }}>Clasificación: {activeGroupName}</p>
            </div>
            <div id="share-image-columns" style={{ display: 'flex', gap: '20px', justifyContent: 'space-between' }}>
                <div id="share-col-left" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {validResults.slice(0, mid).map((r, idx) => {
                      let rankDisplay = r.rank;
                      if (r.rank === 1) rankDisplay = "🥇";
                      else if (r.rank === 2) rankDisplay = "🥈";
                      else if (r.rank === 3) rankDisplay = "🥉";
                      else if (r.rank === lowestPaidRank && lowestPaidRank > 3) rankDisplay = "🐢";
                      
                      return (
                          <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', width: '30px', textAlign: 'center', color: 'var(--accent-color)' }}>{rankDisplay}</span>
                                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>{r.name}</span>
                              </div>
                              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#00d2d3' }}>{r.points.total} pts</span>
                          </div>
                      );
                    })}
                </div>
                <div id="share-col-right" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {validResults.slice(mid).map((r, idx) => {
                      let rankDisplay = r.rank;
                      if (r.rank === 1) rankDisplay = "🥇";
                      else if (r.rank === 2) rankDisplay = "🥈";
                      else if (r.rank === 3) rankDisplay = "🥉";
                      else if (r.rank === lowestPaidRank && lowestPaidRank > 3) rankDisplay = "🐢";
                      
                      return (
                          <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', width: '30px', textAlign: 'center', color: 'var(--accent-color)' }}>{rankDisplay}</span>
                                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>{r.name}</span>
                              </div>
                              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#00d2d3' }}>{r.points.total} pts</span>
                          </div>
                      );
                    })}
                </div>
            </div>
        </div>
    </section>
  );
}

export default Leaderboard;
