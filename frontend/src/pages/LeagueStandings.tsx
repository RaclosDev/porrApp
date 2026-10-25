import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { fetchCompetitionStandings } from '../services/api';

function getCompetitionBadge(competitionName) {
  if (!competitionName) return '🏆';
  const lower = competitionName.toLowerCase();
  if (lower.includes('laliga') || lower.includes('copa del rey') || lower.includes('españa'))
    return '🇪🇸';
  if (lower.includes('premier') || lower.includes('inglaterra')) return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (lower.includes('champions') || lower.includes('europa') || lower.includes('conference'))
    return '🇪🇺';
  if (lower.includes('serie a') || lower.includes('italia')) return '🇮🇹';
  if (lower.includes('bundesliga') || lower.includes('alemania')) return '🇩🇪';
  if (lower.includes('ligue 1') || lower.includes('francia')) return '🇫🇷';
  if (lower.includes('mex') || lower.includes('bbva')) return '🇲🇽';
  if (lower.includes('mls') || lower.includes('usa')) return '🇺🇸';
  if (lower.includes('mundial') || lower.includes('world cup') || lower.includes('fifa'))
    return '🌍';
  return '🏆';
}

export default function LeagueStandings() {
  const { activeCompetitionId, activeCompetitionName } = useAppContext();

  const {
    data: standings,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['competitionStandings', activeCompetitionId],
    queryFn: () => fetchCompetitionStandings(activeCompetitionId),
    enabled: Boolean(activeCompetitionId),
    staleTime: 120_000,
  });

  const compBadge = getCompetitionBadge(activeCompetitionName);
  const compTitle = activeCompetitionName || 'Competición Regular';

  return (
    <section
      className="view-section active"
      style={{ maxWidth: '960px', margin: '0 auto', padding: '16px' }}
    >
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <div
          style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}
        >
          <span style={{ fontSize: '2rem' }}>{compBadge}</span>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>{compTitle}</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--text-muted, #94a3b8)', fontSize: '0.9rem' }}>
          Tabla de posiciones oficial del torneo real actualizada desde ESPN.
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Array.from({ length: 10 }).map((_, idx) => (
            <div
              key={idx}
              className="skeleton-card"
              style={{
                height: '44px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
              }}
            />
          ))}
        </div>
      ) : isError || !standings || standings.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: '32px 20px',
            textAlign: 'center',
            color: 'var(--text-muted, #94a3b8)',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📊</div>
          <p style={{ margin: 0, fontSize: '1rem', color: '#fff', fontWeight: 600 }}>
            No hay datos de clasificación disponibles en este momento.
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem' }}>
            Los datos se sincronizarán en cuanto se disputen los partidos de la temporada.
          </p>
        </div>
      ) : (
        <div
          className="glass-panel"
          style={{
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '0.9rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    background: 'rgba(15, 23, 42, 0.85)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-muted, #94a3b8)',
                    fontSize: '0.78rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  <th style={{ padding: '12px 14px', width: '44px', textAlign: 'center' }}>#</th>
                  <th style={{ padding: '12px 14px' }}>Club</th>
                  <th
                    style={{
                      padding: '12px 14px',
                      textAlign: 'center',
                      fontWeight: 700,
                      color: 'var(--accent-color, #00d2d3)',
                    }}
                  >
                    PTS
                  </th>
                  <th style={{ padding: '12px 12px', textAlign: 'center' }}>PJ</th>
                  <th style={{ padding: '12px 12px', textAlign: 'center' }}>V</th>
                  <th style={{ padding: '12px 12px', textAlign: 'center' }}>E</th>
                  <th style={{ padding: '12px 12px', textAlign: 'center' }}>D</th>
                  <th style={{ padding: '12px 12px', textAlign: 'center' }}>DG</th>
                  <th style={{ padding: '12px 12px', textAlign: 'center' }}>GF</th>
                  <th style={{ padding: '12px 12px', textAlign: 'center' }}>GC</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => {
                  let rankIndicatorColor = 'transparent';
                  if (row.rank >= 1 && row.rank <= 4)
                    rankIndicatorColor = '#00d2d3'; // Champions
                  else if (row.rank >= 5 && row.rank <= 6)
                    rankIndicatorColor = '#f39c12'; // Europa League
                  else if (row.rank >= 18) rankIndicatorColor = '#e74c3c'; // Relegation

                  return (
                    <tr
                      key={row.rank + row.teamName}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <td
                        style={{ padding: '10px 14px', textAlign: 'center', position: 'relative' }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            width: '24px',
                            height: '24px',
                            lineHeight: '24px',
                            borderRadius: '6px',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            background: row.rank <= 3 ? 'rgba(0, 210, 211, 0.15)' : 'transparent',
                            color: row.rank <= 3 ? '#00d2d3' : 'inherit',
                            boxShadow:
                              rankIndicatorColor !== 'transparent'
                                ? `inset 3px 0 0 ${rankIndicatorColor}`
                                : 'none',
                          }}
                        >
                          {row.rank}
                        </span>
                      </td>

                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {row.teamLogo ? (
                            <img
                              src={row.teamLogo}
                              alt={row.teamName}
                              width={26}
                              height={26}
                              style={{ width: '26px', height: '26px', objectFit: 'contain' }}
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: '1.1rem' }}>🛡️</span>
                          )}
                          <span style={{ fontWeight: 600, color: '#fff' }}>{row.teamName}</span>
                        </div>
                      </td>

                      <td
                        style={{
                          padding: '10px 14px',
                          textAlign: 'center',
                          fontWeight: 800,
                          fontSize: '1rem',
                          color: '#fff',
                          background: 'rgba(0, 210, 211, 0.06)',
                        }}
                      >
                        {row.points}
                      </td>

                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'center',
                          color: 'var(--text-muted, #94a3b8)',
                        }}
                      >
                        {row.gamesPlayed}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#10b981' }}>
                        {row.wins}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'center',
                          color: 'var(--text-muted, #94a3b8)',
                        }}
                      >
                        {row.ties}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#ff6b6b' }}>
                        {row.losses}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'center',
                          fontWeight: 600,
                          color:
                            row.goalDiff > 0
                              ? '#10b981'
                              : row.goalDiff < 0
                                ? '#ff6b6b'
                                : 'var(--text-muted, #94a3b8)',
                        }}
                      >
                        {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'center',
                          color: 'var(--text-muted, #94a3b8)',
                        }}
                      >
                        {row.goalsFor}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'center',
                          color: 'var(--text-muted, #94a3b8)',
                        }}
                      >
                        {row.goalsAgainst}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(15, 23, 42, 0.6)',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              fontSize: '0.78rem',
              color: 'var(--text-muted, #94a3b8)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  background: '#00d2d3',
                }}
              />
              <span>Champions League</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  background: '#f39c12',
                }}
              />
              <span>Europa League</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  background: '#e74c3c',
                }}
              />
              <span>Descenso</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
