import { useAppContext } from '../context/AppContext';
import { getCountryCode } from '../utils/constants';
import { openStats } from '../utils/navigation';

function Radar() {
  const { matchRadar, loading } = useAppContext();

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando partidos...</div>;

  const liveMatches = matchRadar?.live || [];
  const lastMatches = (matchRadar?.last || []).slice(0, 10);
  const nextMatches = (matchRadar?.next || []).slice(0, 10);

  const renderMatchCard = (m, type) => {
    const d = new Date(m.date);
    let dateFormatted = `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    let icon = type === 'live' ? '🔴' : type === 'last' ? '✔️' : '🕒';

    const homeFlag = <img src={`https://flagcdn.com/20x15/${getCountryCode(m.home)}.png`} alt="" />;
    const awayFlag = <img src={`https://flagcdn.com/20x15/${getCountryCode(m.away)}.png`} alt="" />;

    let scoreHtml = '';
    if (type === 'last') {
      scoreHtml = `<span class="last-match-score">${m.homeScore !== null ? m.homeScore : ''} - ${m.awayScore !== null ? m.awayScore : ''}</span>`;
    } else {
      scoreHtml = `<span style="font-size: 0.9em; color: var(--text-muted); font-weight: bold;">VS</span>`;
    }

    return (
      <div key={m.id} className="last-match-card">
        <div className="last-match-date">{icon} {dateFormatted}</div>
        <div className="last-match-teams" style={{ margin: 'auto 0' }}>
          <div className="last-match-team">
            {homeFlag}
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
            {awayFlag}
            <span>{m.away}</span>
          </div>
        </div>

        {/* Action Buttons at the bottom */}
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
      </div>
    );
  };

  return (
    <section id="view-radar" className="view-section" style={{ display: 'block' }}>
      <div className="section-header" style={{ marginBottom: '20px', textAlign: 'center' }}>
        <h2 style={{ margin: 0 }}>Panel de Partidos</h2>
      </div>

      <div className="radar-container" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

        {liveMatches.length > 0 && (
          <div className="radar-column" style={{ width: '100%', maxWidth: '600px', margin: '0 auto', marginBottom: '10px' }}>
            <h3 style={{ textAlign: 'center', color: '#ff4757', textShadow: '0 0 10px rgba(255,71,87,0.5)', marginBottom: '15px' }}>🔴 EN DIRECTO</h3>
            <div className="last-matches-grid" style={{ gridTemplateColumns: '1fr' }}>
              {liveMatches.map(m => renderMatchCard(m, 'live'))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', width: '100%' }}>
          <div className="radar-column" style={{ flex: 1, minWidth: 'min(100%, 300px)' }}>
            <h3 style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '15px' }}>Últimos Resultados</h3>
            <div className="last-matches-grid" style={{ gridTemplateColumns: '1fr' }}>
              {lastMatches.map(m => renderMatchCard(m, 'last'))}
            </div>
          </div>

          <div className="radar-column" style={{ flex: 1, minWidth: 'min(100%, 300px)' }}>
            <h3 style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '15px' }}>Próximos Partidos</h3>
            <div className="last-matches-grid" style={{ gridTemplateColumns: '1fr' }}>
              {nextMatches.map(m => renderMatchCard(m, 'next'))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Radar;
