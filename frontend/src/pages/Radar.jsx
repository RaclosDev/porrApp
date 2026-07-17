import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { openStats } from '../utils/navigation';
import Flag from '../components/Flag';

/**
 * Componente que muestra los partidos en vivo, recientes y próximos.
 * Permite a los usuarios tener una visión rápida de los resultados más actuales
 * o abrir estadísticas de un partido específico.
 *
 * @component
 * @returns {JSX.Element} La vista del radar de partidos.
 */
function Radar() {
  const { matchRadar, loading } = useAppContext();
  const [activeTab, setActiveTab] = useState('proximos');

  if (loading) return (
    <section className="view-section" style={{ display: 'block' }}>
      <div className="skeleton skeleton-text short" style={{ height: '24px', margin: '0 auto 30px auto' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '600px', margin: '0 auto' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-card" style={{ minHeight: '120px' }}>
            <div className="skeleton skeleton-text short" style={{ margin: '0 auto' }} />
            <div className="skeleton-row" style={{ justifyContent: 'center', gap: '20px' }}>
              <div className="skeleton skeleton-avatar" style={{ width: '24px', height: '18px' }} />
              <div className="skeleton skeleton-bar" style={{ maxWidth: '100px' }} />
              <div className="skeleton" style={{ width: '60px', height: '24px', borderRadius: '6px' }} />
              <div className="skeleton skeleton-bar" style={{ maxWidth: '100px' }} />
              <div className="skeleton skeleton-avatar" style={{ width: '24px', height: '18px' }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const liveMatches = matchRadar?.live || [];
  const lastMatches = (matchRadar?.last || []).slice(0, 10);
  const nextMatches = (matchRadar?.next || []).slice(0, 10);

  const renderMatchCard = (m, type) => {
    const d = new Date(m.date);
    let dateFormatted = `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    let isActuallyLive = type === 'live' && new Date(m.date) <= new Date();
    let icon = isActuallyLive ? '🔴' : type === 'live' ? '⏳' : type === 'last' ? '✔️' : '🕒';

    const isPlaceholder = (t) => !t || t.toLowerCase().includes('por definir') || t.toLowerCase().includes('tbd') || t.includes('º') || t === '?';
    const showStatsButton = m.home && m.away && !isPlaceholder(m.home) && !isPlaceholder(m.away);

    return (
      <div key={m.id} className="last-match-card">
        <div className="last-match-date">
            {icon} {isActuallyLive ? (m.displayClock || 'EN JUEGO') : dateFormatted}
        </div>
        <div className="last-match-teams" style={{ margin: 'auto 0' }}>
          <div className="last-match-team">
            <Flag team={m.home} />
            <span>{m.home}</span>
          </div>

          <div className="last-match-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {(type === 'last' || (type === 'live' && m.homeScore !== null && m.awayScore !== null)) ? (
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

        {/* Action Buttons at the bottom */}
        {showStatsButton && (
          <div style={{ textAlign: 'center' }}>
            {type === 'last' ? (
              <button onClick={() => openStats(m.home, m.away)} style={{ background: '#1e272e', color: '#00d2d3', border: '1px solid rgba(0,210,211,0.3)', padding: '6px 20px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                <span>📊</span> Stats
              </button>
            ) : (type === 'next' || type === 'live') ? (
              <button onClick={() => openStats(m.home, m.away)} style={{ background: '#1e272e', color: '#00d2d3', border: '1px solid rgba(0,210,211,0.3)', padding: '6px 20px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                <span>📊</span> Ver Estadísticas
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  return (
    <section id="view-radar" className="view-section" style={{ display: 'block' }}>
      <div className="section-header" style={{ marginBottom: '20px', textAlign: 'center' }}>
        <h2 style={{ margin: 0 }}>Panel de Partidos</h2>
      </div>

      <div className="radar-container" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

        {liveMatches.length > 0 && (() => {
          const isActuallyLive = liveMatches.some(m => new Date(m.date) <= new Date());
          return (
            <div className="radar-column" style={{ width: '100%', maxWidth: '600px', margin: '0 auto', marginBottom: '10px' }}>
              <h3 style={{ 
                textAlign: 'center', 
                color: isActuallyLive ? '#ff4757' : '#ffa502', 
                textShadow: isActuallyLive ? '0 0 10px rgba(255,71,87,0.5)' : '0 0 10px rgba(255,165,2,0.5)', 
                marginBottom: '15px' 
              }}>
                {isActuallyLive ? '🔴 EN DIRECTO' : '⏳ A PUNTO DE COMENZAR'}
              </h3>
              <div className="last-matches-grid" style={{ gridTemplateColumns: '1fr' }}>
                {liveMatches.map(m => renderMatchCard(m, 'live'))}
              </div>
            </div>
          );
        })()}

        <div className="radar-tabs hide-on-desktop" style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
          <button 
            className="glass-btn"
            onClick={() => setActiveTab('proximos')}
            style={{ flex: 1, maxWidth: '200px', background: activeTab === 'proximos' ? 'rgba(0, 210, 211, 0.2)' : '', border: activeTab === 'proximos' ? '1px solid #00d2d3' : '' }}
          >
            Próximos Partidos
          </button>
          <button 
            className="glass-btn"
            onClick={() => setActiveTab('ultimos')}
            style={{ flex: 1, maxWidth: '200px', background: activeTab === 'ultimos' ? 'rgba(0, 210, 211, 0.2)' : '', border: activeTab === 'ultimos' ? '1px solid #00d2d3' : '' }}
          >
            Últimos Resultados
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', width: '100%' }}>
          <div className={`radar-column radar-col-proximos ${activeTab === 'proximos' ? 'active-mobile' : ''}`} style={{ flex: 1, width: '100%' }}>
            <h3 className="hide-on-mobile" style={{ textAlign: 'center', color: '#00d2d3', marginBottom: '15px' }}>Próximos Partidos</h3>
            <div className="last-matches-grid" style={{ gridTemplateColumns: '1fr' }}>
              {nextMatches.map(m => renderMatchCard(m, 'next'))}
            </div>
          </div>

          <div className={`radar-column radar-col-ultimos ${activeTab === 'ultimos' ? 'active-mobile' : ''}`} style={{ flex: 1, width: '100%' }}>
            <h3 className="hide-on-mobile" style={{ textAlign: 'center', color: '#00d2d3', marginBottom: '15px' }}>Últimos Resultados</h3>
            <div className="last-matches-grid" style={{ gridTemplateColumns: '1fr' }}>
              {lastMatches.map(m => renderMatchCard(m, 'last'))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Radar;
