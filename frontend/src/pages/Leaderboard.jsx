import { useAppContext } from '../context/AppContext';
import { calculatePoints } from '../utils/points';
import { decodeHash } from '../utils/hash';
import html2canvas from 'html2canvas';
import { useState } from 'react';

function Leaderboard() {
  const state = useAppContext();
  const { participantsHashes, officialResultsHash, loading, isAdminAuthenticated } = state;
  const [sharing, setSharing] = useState(false);

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando clasificación...</div>;

  // Process leaderboard points
  const results = participantsHashes.map(h => {
    const part = decodeHash(h.hash); 
    let official = null; 
    if (officialResultsHash) {
        official = decodeHash(officialResultsHash);
    }

    const pts = calculatePoints(part, official, state);
    return { 
        key: h.key, 
        hash: h.hash, 
        name: part?.user || 'Anónimo', 
        betName: part?.bet || '', 
        points: pts, 
        paid: h.paid, 
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

  const validResults = results.filter(r => r.paid);
  const mid = Math.ceil(validResults.length / 2);

  return (
    <section id="view-leaderboard" className="view-section" style={{ display: 'block' }}>
        <div className="section-header" style={{ marginBottom: '20px', textAlign: 'center' }}>
            <h2 style={{ margin: 0 }}>Clasificación Global</h2>
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
                            <th>Goleador</th>
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

                            const rowStyle = { opacity: r.paid ? 1 : 0.5, cursor: 'pointer' };

                            return (
                                <tr key={r.key} style={rowStyle}>
                                    <td style={{ fontSize: '1.2em', textAlign: 'center' }}>{rankDisplay}</td>
                                    <td>
                                        <span title={`Ver Apuesta de ${r.name}`}><strong>{r.name}</strong></span>
                                        {isAdminAuthenticated && (
                                            <button onClick={() => state.editBetName(r.key, r.hash)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9em', marginLeft: '5px' }} title="Editar Nombre/Apuesta">✏️</button>
                                        )}
                                        <br />
                                        <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>{r.betName}</span>
                                        {!r.paid && <span style={{ fontSize: '10px', background: 'orange', color: 'white', padding: '2px', borderRadius: '3px', marginLeft: '5px' }}>Pendiente</span>}
                                        {isAdminAuthenticated && !r.paid && (
                                            <button onClick={() => state.acceptBet(r.key)} style={{ background: 'green', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', marginLeft: '5px' }} title="Confirmar Bizum">✔️</button>
                                        )}
                                        {isAdminAuthenticated && (
                                            <button onClick={() => state.deleteBet(r.key)} style={{ background: 'red', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', marginLeft: '5px' }} title="Borrar Apuesta">🗑️</button>
                                        )}
                                        {isAdminAuthenticated && r.paid && r.part && r.part.thirdPlaceMatch && r.part.thirdPlaceMatch.length === 2 && !r.part.thirdPlaceWinner && (
                                            <>
                                                <button onClick={() => state.fixThird(r.key, r.hash, r.part.thirdPlaceMatch[0])} style={{ background: '#00d2d3', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', marginLeft: '5px' }} title={`Fijar ${r.part.thirdPlaceMatch[0]}`}>3º: {r.part.thirdPlaceMatch[0]}</button>
                                                <button onClick={() => state.fixThird(r.key, r.hash, r.part.thirdPlaceMatch[1])} style={{ background: '#ff4757', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', marginLeft: '5px' }} title={`Fijar ${r.part.thirdPlaceMatch[1]}`}>3º: {r.part.thirdPlaceMatch[1]}</button>
                                            </>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); state.setViewerHash(r.hash); }} style={{ background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', marginLeft: '5px' }} title="Ver Apuesta">👁️</button>
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
                <p style={{ color: '#ff9f43', margin: '5px 0 0 0', fontSize: '18px', fontWeight: 'bold' }}>Clasificación Oficial</p>
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
