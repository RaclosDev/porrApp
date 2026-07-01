import { useLeaderboard } from '../hooks/useLeaderboard';

/**
 * Componente que muestra la tabla de clasificación (Leaderboard) de una liga.
 * Renderiza los participantes, sus puntos y proporciona acciones de administrador si corresponde.
 *
 * @component
 * @returns {JSX.Element} La vista de la tabla de clasificación.
 */
function Leaderboard() {
  const {
    state,
    results,
    loading,
    isRaclos,
    activeGroupName,
    userId,
    userName,
    isLeagueAdmin,
    lowestPaidRank,
    sharing,
    actionLoading,
    handleShare,
    handleAcceptBet,
    handleDeleteBet,
    validResults
  } = useLeaderboard();

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando clasificación...</div>;

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
                            if (r.rank === 1) rankDisplay = "🥇";
                            else if (r.rank === 2) rankDisplay = "🥈";
                            else if (r.rank === 3) rankDisplay = "🥉";
                            else if (r.paid && r.rank === lowestPaidRank && lowestPaidRank > 3) rankDisplay = "🐢";

                            const isPending = !r.paid;
                            const isMe = r.userId?.toString() === userId?.toString() || r.name === userName;
                            const bgStyle = isMe ? 'rgba(0, 210, 211, 0.15)' : (isPending ? 'rgba(255, 165, 0, 0.05)' : 'transparent');

                            const rowStyle = { 
                                background: bgStyle, 
                                boxShadow: isMe ? 'inset 0 0 0 1px var(--accent-color), 0 0 15px rgba(0, 210, 211, 0.2)' : 'none',
                                cursor: 'pointer' 
                            };

                            return (
                                <tr key={r.key} style={rowStyle}>
                                    <td style={{ fontSize: '1.2em', textAlign: 'center' }}>{rankDisplay}</td>
                                    <td>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <span title={`Ver Apuesta de ${r.name}`} style={{ fontSize: '1.1em' }}><strong>{r.name} {isMe && <span style={{ color: 'var(--accent-color)', marginLeft: '5px', fontSize: '0.8em' }}>(Tú)</span>}</strong></span>
                                                    {isPending && <span style={{ fontSize: '10px', background: 'orange', color: 'white', padding: '2px 4px', borderRadius: '4px', marginLeft: '8px' }}>⏳ Pendiente</span>}
                                                </div>
                                                <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>{r.betName}</div>
                                            </div>
                                            
                                            <button className="glass-btn" onClick={(e) => { e.stopPropagation(); state.setViewerBetId(r.id); }} style={{ background: 'rgba(56, 173, 246, 0.2)', color: '#38adf6', border: '1px solid #38adf6', padding: '4px 8px', fontSize: '0.8rem', whiteSpace: 'nowrap' }} title="Ver Apuesta">
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
                                                    <button className="glass-btn" onClick={(e) => { e.stopPropagation(); state.editBetName(r.key, r.id); }} style={{ background: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', border: '1px solid #fbbf24', padding: '4px 8px', fontSize: '0.8rem' }} title="Editar Nombre">
                                                        ✏️ Editar
                                                    </button>
                                                )}
                                                
                                                {isRaclos && r.paid && r.thirdPlaceMatch && r.thirdPlaceMatch.length === 2 && !r.thirdPlaceWinner && (
                                                    <>
                                                        <button className="glass-btn" onClick={(e) => { e.stopPropagation(); state.fixThird(r.key, r.id, r.thirdPlaceMatch[0]); }} style={{ background: 'rgba(0, 210, 211, 0.2)', color: '#00d2d3', border: '1px solid #00d2d3', padding: '4px 8px', fontSize: '0.8rem' }}>3º: {r.thirdPlaceMatch[0]}</button>
                                                        <button className="glass-btn" onClick={(e) => { e.stopPropagation(); state.fixThird(r.key, r.id, r.thirdPlaceMatch[1]); }} style={{ background: 'rgba(0, 210, 211, 0.2)', color: '#00d2d3', border: '1px solid #00d2d3', padding: '4px 8px', fontSize: '0.8rem' }}>3º: {r.thirdPlaceMatch[1]}</button>
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
                    {validResults.slice(0, mid).map((r) => {
                      let rankDisplay = r.rank;
                      if (r.rank === 1) rankDisplay = "🥇";
                      else if (r.rank === 2) rankDisplay = "🥈";
                      else if (r.rank === 3) rankDisplay = "🥉";
                      else if (r.rank === lowestPaidRank && lowestPaidRank > 3) rankDisplay = "🐢";
                      
                      const isMe = r.name === userName;
                      return (
                          <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isMe ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px', border: isMe ? '1px solid #00d2d3' : '1px solid rgba(255,255,255,0.05)' }}>
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
                    {validResults.slice(mid).map((r) => {
                      let rankDisplay = r.rank;
                      if (r.rank === 1) rankDisplay = "🥇";
                      else if (r.rank === 2) rankDisplay = "🥈";
                      else if (r.rank === 3) rankDisplay = "🥉";
                      else if (r.rank === lowestPaidRank && lowestPaidRank > 3) rankDisplay = "🐢";
                      
                      const isMe = r.name === userName;
                      return (
                          <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isMe ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px', border: isMe ? '1px solid #00d2d3' : '1px solid rgba(255,255,255,0.05)' }}>
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
