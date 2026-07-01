import Flag from '../Flag';
import { openStats } from '../../utils/navigation';

/**
 * Componente que muestra los partidos que se están jugando en directo o el próximo en comenzar.
 *
 * @component
 * @param {Object} props
 * @param {Array} props.liveMatches - Lista de partidos actualmente en juego.
 * @param {Object} props.matchRadar - Objeto con datos de próximos partidos ({ next: [...] }).
 * @returns {JSX.Element|null} Panel renderizado con los partidos, o null si no hay datos.
 */
function LiveMatchesPanel({ liveMatches, matchRadar }) {
    const renderLiveMatch = (m) => {
        const d = new Date(m.date);
        const dateFormatted = `${d.getDate()}/${d.getMonth()+1} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        const hasStarted = new Date() >= d;

        return (
            <div key={m.id} className="last-match-card">
                <div className="last-match-date">
                    {hasStarted ? '🔴' : '⏳'} {hasStarted ? (m.displayClock || 'EN JUEGO') : dateFormatted}
                </div>
                <div className="last-match-teams" style={{ margin: 'auto 0' }}>
                    <div className="last-match-team">
                        <Flag team={m.home} />
                        <span>{m.home}</span>
                    </div>
                    
                    <div className="last-match-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {hasStarted ? (
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
                
                <div style={{ textAlign: 'center' }}>
                    <button onClick={() => openStats(m.home, m.away)} style={{ background: '#1e272e', color: '#00d2d3', border: '1px solid rgba(0,210,211,0.3)', padding: '6px 20px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                        <span>📊</span> Ver Estadísticas
                    </button>
                </div>
            </div>
        );
    };

    if (liveMatches.length > 0) {
        const isActuallyLive = liveMatches.some(m => new Date(m.date) <= new Date());
        return (
            <div style={{ width: '100%', maxWidth: '480px', margin: '0 auto 20px auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ 
                    textAlign: 'center', 
                    color: isActuallyLive ? '#ff4757' : '#ffa502', 
                    fontSize: '1rem', 
                    fontWeight: 'bold', 
                    padding: '6px', 
                    background: isActuallyLive ? 'rgba(255, 71, 87, 0.1)' : 'rgba(255, 165, 2, 0.1)', 
                    border: isActuallyLive ? '1px solid rgba(255, 71, 87, 0.3)' : '1px solid rgba(255, 165, 2, 0.3)', 
                    borderRadius: '12px' 
                }}>
                    {isActuallyLive ? '🔴 EN DIRECTO' : '⏳ A PUNTO DE COMENZAR'}
                </div>
                <div className="last-matches-grid" style={{ gridTemplateColumns: '1fr' }}>
                    {liveMatches.map(m => renderLiveMatch(m))}
                </div>
            </div>
        );
    }

    const next = (matchRadar?.next || [])[0];
    if (!next) return null;

    const d = new Date(next.date);
    const dateFormatted = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    return (
        <div style={{ width: '100%', maxWidth: '480px', margin: '0 auto 20px auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ textAlign: 'center', color: '#a29bfe', fontSize: '1rem', fontWeight: 'bold', padding: '6px', background: 'rgba(162, 155, 254, 0.1)', border: '1px solid rgba(162, 155, 254, 0.3)', borderRadius: '12px' }}>
                ⏳ PRÓXIMO PARTIDO
            </div>
            <div className="last-match-card">
                <div className="last-match-date">🕒 {dateFormatted}</div>
                <div className="last-match-teams" style={{ margin: 'auto 0' }}>
                    <div className="last-match-team"><Flag team={next.home} /> <span>{next.home}</span></div>
                    <div className="last-match-center"><span style={{ fontSize: '0.9em', color: 'var(--text-muted)', fontWeight: 'bold' }}>VS</span></div>
                    <div className="last-match-team away"><Flag team={next.away} /> <span>{next.away}</span></div>
                </div>
            </div>
        </div>
    );
}

export default LiveMatchesPanel;
