import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { openStats } from '../utils/navigation';
import Flag from '../components/Flag';
import type { Match } from '../types/api';

/**
 * Componente que muestra los partidos en vivo, recientes y proximos.
 */
function Radar() {
  const { matchRadar, loading } = useAppContext();
  const [activeTab, setActiveTab] = useState('proximos');

  if (loading)
    return (
      <section className="view-section active block">
        <div className="skeleton skeleton-text short h-6 mt-0 mb-7.5 mx-auto" />
        <div className="flex flex-col gap-[15px] max-w-150 my-0 mx-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-card min-h-30">
              <div className="skeleton skeleton-text short my-0 mx-auto" />
              <div className="skeleton-row justify-center gap-5">
                <div className="skeleton skeleton-avatar w-6 h-4.5" />
                <div className="skeleton skeleton-bar max-w-25" />
                <div className="skeleton w-15 h-6 rounded-[6px]" />
                <div className="skeleton skeleton-bar max-w-25" />
                <div className="skeleton skeleton-avatar w-6 h-4.5" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );

  const liveMatches = matchRadar?.live || [];
  const lastMatches = (matchRadar?.last || []).slice(0, 10);
  const nextMatches = (matchRadar?.next || []).slice(0, 10);

  const renderMatchCard = (m: Match, type: 'live' | 'last' | 'next') => {
    const d = new Date(m.date ?? 0);
    const dateFormatted = `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    const isActuallyLive = type === 'live' && new Date(m.date ?? 0) <= new Date();
    const statusLabel = isActuallyLive ? m.displayClock || 'En Juego' : dateFormatted;

    const isPlaceholder = (t: string | null | undefined) =>
      !t ||
      t.toLowerCase().includes('por definir') ||
      t.toLowerCase().includes('tbd') ||
      t.includes('º') ||
      t === '?';
    const showStatsButton = m.home && m.away && !isPlaceholder(m.home) && !isPlaceholder(m.away);

    return (
      <div key={m.id} className="last-match-card">
        <div className="last-match-date">{statusLabel}</div>
        <div className="last-match-teams my-auto mx-0">
          <div className="last-match-team">
            <Flag team={m.home} logo={m.homeLogo || m.homeTeamLogo} />
            <span>{m.home}</span>
          </div>

          <div className="last-match-center flex flex-col items-center">
            {type === 'last' ||
            (type === 'live' && m.homeScore !== null && m.awayScore !== null) ? (
              <span className="last-match-score">
                {m.homeScore} - {m.awayScore}
              </span>
            ) : (
              <span className="text-[0.9em] text-muted font-bold">VS</span>
            )}
          </div>

          <div className="last-match-team away">
            <Flag team={m.away} logo={m.awayLogo || m.awayTeamLogo} />
            <span>{m.away}</span>
          </div>
        </div>

        {/* Action Buttons at the bottom */}
        {showStatsButton && (
          <div className="text-center mt-2.5">
            <button
              onClick={() => openStats()}
              className="glass-btn py-2 px-4.5 min-h-11 rounded-[8px] text-[0.9rem] font-bold inline-flex items-center justify-center"
              aria-label={`Ver estadísticas entre ${m.home} y ${m.away}`}
            >
              Estadísticas
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section id="view-radar" className="view-section active block">
      <div className="section-header mb-5 text-center">
        <h2 className="m-0" style={{ fontFamily: "'Outfit', sans-serif" }}>
          Panel de Partidos
        </h2>
      </div>

      <div className="radar-container flex flex-col gap-7.5">
        {liveMatches.length > 0 &&
          (() => {
            const isActuallyLive = liveMatches.some((m) => new Date(m.date ?? 0) <= new Date());
            return (
              <div className="radar-column w-full max-w-150 my-0 mx-auto mb-2.5">
                <h3
                  className={`text-center mb-[15px] ${isActuallyLive ? 'text-[#ff4757]' : 'text-[#ffa502]'}`}
                >
                  {isActuallyLive ? 'En Directo' : 'A punto de comenzar'}
                </h3>
                <div className="last-matches-grid grid-cols-[1fr]">
                  {liveMatches.map((m) => renderMatchCard(m, 'live'))}
                </div>
              </div>
            );
          })()}

        <div className="radar-tabs hide-on-desktop flex justify-center gap-2.5 mb-2.5">
          <button
            className={`glass-btn flex-1 max-w-50 ${activeTab === 'proximos' ? 'bg-[rgba(0,_210,_211,_0.2)]' : ''} ${activeTab === 'proximos' ? 'border border-cyan' : ''}`}
            onClick={() => setActiveTab('proximos')}
          >
            Próximos Partidos
          </button>
          <button
            className={`glass-btn flex-1 max-w-50 ${activeTab === 'ultimos' ? 'bg-[rgba(0,_210,_211,_0.2)]' : ''} ${activeTab === 'ultimos' ? 'border border-cyan' : ''}`}
            onClick={() => setActiveTab('ultimos')}
          >
            Últimos Resultados
          </button>
        </div>

        <div className="flex flex-wrap gap-5 w-full">
          <div
            className={`radar-column radar-col-proximos ${activeTab === 'proximos' ? 'active-mobile' : ''}`}
            style={{ flex: 1, width: '100%' }}
          >
            <h3 className="hide-on-mobile text-center text-cyan mb-[15px]">Próximos Partidos</h3>
            <div className="last-matches-grid grid-cols-[1fr]">
              {nextMatches.length === 0 ? (
                <div className="text-center text-muted py-6 px-0 italic">
                  {lastMatches.length > 0
                    ? 'No hay próximos partidos programados. Si ya se han disputado todos los encuentros, la competición ha terminado.'
                    : 'No hay próximos partidos programados. Es posible que el calendario aún no esté disponible.'}
                </div>
              ) : (
                nextMatches.map((m) => renderMatchCard(m, 'next'))
              )}
            </div>
          </div>

          <div
            className={`radar-column radar-col-ultimos ${activeTab === 'ultimos' ? 'active-mobile' : ''}`}
            style={{ flex: 1, width: '100%' }}
          >
            <h3 className="hide-on-mobile text-center text-cyan mb-[15px]">Últimos Resultados</h3>
            <div className="last-matches-grid grid-cols-[1fr]">
              {lastMatches.length === 0 ? (
                <div className="text-center text-muted py-6 px-0 italic">
                  No hay partidos finalizados recientemente.
                </div>
              ) : (
                lastMatches.map((m) => renderMatchCard(m, 'last'))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Radar;
