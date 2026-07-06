import { useState } from 'react';
import { getCountryCode } from '../utils/constants';
import { useStatsData } from '../hooks/useStatsData';

/**
 * Vista de Estadísticas Globales de la porra.
 * Muestra métricas agregadas de todos los usuarios (quién es el más votado para campeón, pichichi, etc.).
 *
 * @component
 * @returns {JSX.Element} Vista de las estadísticas globales.
 */
function Stats() {
  const { stats, loading } = useStatsData();
  const [modalData, setModalData] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando estadísticas...</div>;

  const ProgressBarItem = ({ name, usersArray, total, icon, isFinals = false, color = "var(--accent-color)", overridePercentage }) => {
    let flagHtml = null;
    let cleanName = name;
    const isTwins = name && typeof name === 'string' && name.includes(" 🤝 ");

    if (isTwins) {
        // Almas Gemelas format
        cleanName = <span>{name}</span>;
    } else if (isFinals) {
      const teams = name.split(" vs ");
      const t1 = teams[0], t2 = teams[1];
      const f1 = t1.includes("º") ? null : <img src={`https://flagcdn.com/w80/${getCountryCode(t1)}.png`} alt="" style={{ width: '16px', height: '12px', objectFit: 'cover', borderRadius: '2px' }} />;
      const f2 = t2.includes("º") ? null : <img src={`https://flagcdn.com/w80/${getCountryCode(t2)}.png`} alt="" style={{ width: '16px', height: '12px', objectFit: 'cover', borderRadius: '2px' }} />;
      cleanName = <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>{f1} {t1} <span>vs</span> {t2} {f2}</span>;
    } else if (!name.includes("º")) {
      flagHtml = <img src={`https://flagcdn.com/w80/${getCountryCode(name)}.png`} alt="" style={{ width: '16px', height: '12px', objectFit: 'cover', marginRight: '8px', borderRadius: '2px' }} />;
    }

    const count = usersArray.length;
    const percentage = overridePercentage !== undefined ? overridePercentage : (total > 0 ? Math.round((count / total) * 100) : 0);

    return (
      <div 
        onClick={() => setModalData({ title: name, users: usersArray, percentage, count, isTwins })}
        style={{ cursor: 'pointer', marginBottom: '15px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.95rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
            {icon && <span style={{ marginRight: '8px' }}>{icon}</span>}
            {flagHtml}{cleanName}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <span style={{ color: 'white', fontWeight: 'bold' }}>{percentage}%</span> {!isTwins && `(${count})`}
          </div>
        </div>
        <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', height: '10px', overflow: 'hidden' }}>
          <div 
            style={{ 
                height: '100%', 
                width: `${percentage}%`, 
                background: color,
                borderRadius: '10px',
                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: `0 0 10px ${color}`
            }} 
          />
        </div>
      </div>
    );
  };

  const renderCard = (title, icon, dataList, color, isFinals = false) => {
    const top5 = dataList.slice(0, 5);
    const hasMore = dataList.length > 5;

    return (
      <div className="group-card" style={{ flex: 1, minWidth: '300px', background: 'rgba(20,20,35,0.8)', border: `1px solid ${color}40`, padding: '25px', borderRadius: '16px' }}>
          <h3 
            onClick={() => hasMore && setExpandedCard({ title, icon, dataList, color, isFinals })}
            style={{ color: color, marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', cursor: hasMore ? 'pointer' : 'default' }}
          >
              {icon} {title}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
              {dataList.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                      Sin datos suficientes
                  </div>
              ) : (
                  <>
                    {top5.map(([name, users, override]) => (
                        <ProgressBarItem key={name} name={name} usersArray={users} total={stats.total} isFinals={isFinals} color={color} overridePercentage={override} />
                    ))}
                    {hasMore && (
                        <button 
                            onClick={() => setExpandedCard({ title, icon, dataList, color, isFinals })}
                            className="glass-btn" 
                            style={{ marginTop: '10px', padding: '8px', fontSize: '0.9rem', color: color, borderColor: `${color}40`, background: 'rgba(255,255,255,0.05)', width: '100%' }}
                        >
                            Ver {dataList.length - 5} más...
                        </button>
                    )}
                  </>
              )}
          </div>
      </div>
    );
  };

  return (
    <section id="view-stats" className="view-section" style={{ display: 'block', opacity: 1 }}>
      <div className="section-header" style={{ marginBottom: '40px' }}>
          <h2 style={{ color: '#00d2d3', fontSize: '2.5rem', margin: '0 0 10px 0' }}>Estadísticas Globales</h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>Análisis de las {stats.total} porras registradas en el servidor.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '25px', marginTop: '20px' }}>
          {renderCard("Campeón del Mundo", "🏆", stats.champions, "#f1c40f")}
          {renderCard("Subcampeón", "🥈", stats.runnerups, "#95a5a6")}
          {renderCard("Reyes del Grupo (1ºs)", "👑", stats.kings, "#1abc9c")}
          {renderCard("Supervivientes (3ºs)", "🛟", stats.thirds, "#f39c12")}
          {renderCard("Sorpresas (Pasan de Grupo)", "🦄", stats.darkHorses, "#e84393")}
          {renderCard("Llegan a Semifinales", "💫", stats.semis, "#e67e22")}
          {renderCard("Finales Más Repetidas", "⚔️", stats.finals, "#e74c3c", true)}
          {renderCard("Pichichi", "👟", stats.scorers, "#3498db")}
          {renderCard("Decepciones (Caen en Grupos)", "💀", stats.disappointments, "#9b59b6")}
          {renderCard("Almas Gemelas", "👯", stats.twins, "#00d8d6")}
      </div>

      {/* Expanded Card Modal */}
      {expandedCard && (
        <div className="modal" style={{ display: 'flex', zIndex: 999990, backdropFilter: 'blur(5px)' }} onClick={() => setExpandedCard(null)}>
            <div className="modal-content" style={{ maxWidth: '500px', width: '90%', padding: '0', overflow: 'hidden', background: '#1e1e2e', border: `1px solid ${expandedCard.color}40`, display: 'flex', flexDirection: 'column', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', flexShrink: 0 }}>
                    <h3 style={{ color: expandedCard.color, margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      {expandedCard.icon} {expandedCard.title}
                    </h3>
                </div>
                <div style={{ padding: '20px', overflowY: 'auto', flexGrow: 1 }}>
                    {expandedCard.dataList.map(([name, users, override]) => (
                        <ProgressBarItem key={name} name={name} usersArray={users} total={stats.total} isFinals={expandedCard.isFinals} color={expandedCard.color} overridePercentage={override} />
                    ))}
                </div>
                <div style={{ padding: '15px 20px', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                    <button onClick={() => setExpandedCard(null)} className="glass-btn primary-btn" style={{ width: '100%', padding: '10px', fontSize: '1.1rem' }}>
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Stats Detail Modal */}
      {modalData && (
        <div className="modal" style={{ display: 'flex', zIndex: 999999, backdropFilter: 'blur(5px)' }} onClick={() => setModalData(null)}>
            <div className="modal-content" style={{ maxWidth: '400px', padding: '0', overflow: 'hidden', background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '25px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                    <h3 style={{ color: 'white', margin: '0 0 10px 0', fontSize: '1.4rem' }}>
                      {modalData.title}
                    </h3>
                    <div style={{ display: 'inline-block', background: 'rgba(0, 210, 211, 0.1)', color: '#00d2d3', padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold' }}>
                        {modalData.percentage}% de los votos ({modalData.count} personas)
                    </div>
                </div>
                <ul style={{ listStyle: 'none', padding: '10px 0', margin: 0, maxHeight: '350px', overflowY: 'auto' }}>
                  {modalData.users.map((u, i) => (
                    <li key={i} style={{ padding: '12px 25px', display: 'flex', alignItems: 'center' }}>
                      <span style={{ background: 'var(--accent-color)', color: 'black', width: '32px', height: '32px', borderRadius: '50%', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', marginRight: '15px', fontSize: '1rem', boxShadow: '0 2px 10px rgba(0,210,211,0.3)' }}>
                        {u.charAt(0).toUpperCase()}
                      </span>
                      <span style={{ fontSize: '1.05rem', color: '#e2e8f0' }}>{u}</span>
                    </li>
                  ))}
                </ul>
                <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'center' }}>
                    <button onClick={() => setModalData(null)} className="glass-btn primary-btn" style={{ width: '100%', padding: '12px', fontSize: '1.1rem' }}>
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
      )}
    </section>
  );
}

export default Stats;
