import Flag from '../Flag';
import { openStats } from '../../utils/navigation';

function LiveMatchesPanel({ liveMatches, matchRadar, maxNext = 1 }) {
  const renderLiveMatch = (m) => {
    const d = new Date(m.date);
    const dateFormatted = `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    const hasStarted = new Date() >= d;
    const isPlaceholder = (t) =>
      !t ||
      t.toLowerCase().includes('por definir') ||
      t.toLowerCase().includes('tbd') ||
      t.includes('º') ||
      t === '?';
    const showStatsButton = m.home && m.away && !isPlaceholder(m.home) && !isPlaceholder(m.away);

    return (
      <div key={m.id} className="last-match-card">
        <div className="last-match-date">
          {hasStarted ? '🔴' : '🕒'} {hasStarted ? m.displayClock || 'EN JUEGO' : dateFormatted}
        </div>
        <div className="last-match-teams" style={{ margin: 'auto 0' }}>
          <div className="last-match-team">
            <Flag team={m.home} logo={m.homeLogo || m.homeTeamLogo} />
            <span>{m.home}</span>
          </div>

          <div
            className="last-match-center"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            {hasStarted && m.homeScore !== null && m.awayScore !== null ? (
              <span className="last-match-score">
                {m.homeScore} - {m.awayScore}
              </span>
            ) : (
              <span style={{ fontSize: '0.9em', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                VS
              </span>
            )}
          </div>

          <div className="last-match-team away">
            <Flag team={m.away} logo={m.awayLogo || m.awayTeamLogo} />
            <span>{m.away}</span>
          </div>
        </div>

        {showStatsButton && (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => openStats()}
              aria-label={`Ver estadísticas de ${m.home} contra ${m.away}`}
              style={{
                background: '#1e272e',
                color: '#00d2d3',
                border: '1px solid rgba(0,210,211,0.3)',
                borderRadius: '8px',
                minHeight: '44px',
                padding: '10px 18px',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              Ver Estadísticas
            </button>
          </div>
        )}
      </div>
    );
  };

  const nextMatches = (matchRadar?.next || [])
    .filter((m) => !liveMatches.some((live) => live.id === m.id))
    .slice(0, maxNext);
  const hasLive = liveMatches && liveMatches.length > 0;
  const isActuallyLive = hasLive && liveMatches.some((m) => new Date(m.date) <= new Date());

  if (!hasLive && nextMatches.length === 0) {
    return (
      <div
        className="glass-panel"
        role="status"
        style={{
          width: '100%',
          maxWidth: '480px',
          margin: '0 auto 20px auto',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          borderRadius: '12px',
        }}
      >
        <div style={{ fontSize: '1.6rem', marginBottom: '8px' }} aria-hidden="true">
          📅
        </div>
        <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
          No hay próximos partidos
        </p>
        <p style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>
          La competición puede haber terminado o el calendario todavía no estar disponible.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto 20px auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {hasLive && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              textAlign: 'center',
              color: isActuallyLive ? '#ff4757' : '#ffa502',
              fontSize: '1rem',
              fontWeight: 'bold',
              padding: '6px',
              background: isActuallyLive ? 'rgba(255, 71, 87, 0.1)' : 'rgba(255, 165, 2, 0.1)',
              border: isActuallyLive
                ? '1px solid rgba(255, 71, 87, 0.3)'
                : '1px solid rgba(255, 165, 2, 0.3)',
              borderRadius: '12px',
            }}
          >
            {isActuallyLive ? '🔴 EN DIRECTO' : '⏳ A PUNTO DE COMENZAR'}
          </div>
          <div className="last-matches-grid" style={{ gridTemplateColumns: '1fr', gap: '10px' }}>
            {liveMatches.map((m) => renderLiveMatch(m))}
          </div>
        </div>
      )}

      {nextMatches.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              textAlign: 'center',
              color: '#a29bfe',
              fontSize: '1rem',
              fontWeight: 'bold',
              padding: '6px',
              background: 'rgba(162, 155, 254, 0.1)',
              border: '1px solid rgba(162, 155, 254, 0.3)',
              borderRadius: '12px',
            }}
          >
            {nextMatches.length === 1 ? '🔜 PRÓXIMO PARTIDO' : '🔜 PRÓXIMOS PARTIDOS'}
          </div>
          <div className="last-matches-grid" style={{ gridTemplateColumns: '1fr', gap: '10px' }}>
            {nextMatches.map((m) => renderLiveMatch(m))}
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveMatchesPanel;
