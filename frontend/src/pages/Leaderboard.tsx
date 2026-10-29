import React, { useState, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLeaderboard, type SortColumn } from '../hooks/useLeaderboard';

interface LeaderboardColumn {
  key: SortColumn;
  label: string;
  shortLabel?: string;
  kind: 'total' | 'matchday' | 'detail';
}
const EvolutionChart = React.lazy(() => import('../components/EvolutionChart'));
import WhatsAppIcon from '../components/WhatsAppIcon';
import { UserAvatar } from '../components/Avatar';

/** Medalla para el podio, tortuga para el último que ha pagado y número para el resto. */
function rankLabel(rank: number | '-' | undefined, lowestPaidRank: number): string | number {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  if (rank === lowestPaidRank && lowestPaidRank > 3) return '🐢';
  return rank ?? '-';
}

const compactMatchdayLabel = (label: string | null) => {
  if (!label) return '';
  const jornada = /^jornada\s+(\d+)$/i.exec(label);
  if (jornada) return `J${jornada[1]}`;
  const fecha = /^fecha\s+(\d{4})-(\d{2})-(\d{2})$/i.exec(label);
  if (fecha) return `${fecha[3]}/${fecha[2]}`;
  return label;
};

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
    activeGroupName,
    activeGroupPichichi,
    activeGroupPoolFormat,
    userId,
    userName,
    lowestPaidRank,
    sharing,
    handleShare,
    validResults,
    sortColumn,
    sortDirection,
    handleSort,
    matchdays,
    currentMatchday,
    selectedMatchday,
    selectedMatchdayInfo,
    matchdayStats,
    canGoPrevMatchday,
    canGoNextMatchday,
    handleSelectMatchday,
    handleStepMatchday,
  } = useLeaderboard();

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('table'); // 'table' | 'evolution'

  if (loading)
    return (
      <section className="view-section block">
        <div className="table-container p-5">
          <div className="skeleton skeleton-text medium h-5 mb-5" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-row py-3 px-0 border-b border-b-line">
              <div className="skeleton w-6 h-6 rounded-full shrink-0" />
              <div className="skeleton skeleton-bar" />
              <div className="skeleton w-10 h-4 rounded-[4px]" />
              <div className="skeleton w-10 h-4 rounded-[4px]" />
              <div className="skeleton w-12.5 h-5 rounded-[6px]" />
            </div>
          ))}
        </div>
      </section>
    );

  const mid = Math.ceil(validResults.length / 2);

  const isMatchday =
    activeGroupPoolFormat === 'MATCH_DAY' || state.activeCompetitionFormatType === 'LEAGUE';

  const scorerColumn: LeaderboardColumn[] = activeGroupPichichi
    ? [{ key: 'scorer', label: 'Pichichi', kind: 'detail' }]
    : [];
  const columns: LeaderboardColumn[] = isMatchday
    ? [
        { key: 'total', label: 'TOTAL', kind: 'total' },
        selectedMatchday
          ? {
              key: 'matchday',
              label: selectedMatchday,
              shortLabel: compactMatchdayLabel(selectedMatchday),
              kind: 'matchday',
            }
          : { key: 'matchPoints', label: 'Puntos Jornadas', kind: 'detail' },
        ...scorerColumn,
      ]
    : [
        { key: 'total', label: 'TOTAL', kind: 'total' },
        { key: 'matchPoints', label: 'Jornadas', kind: 'detail' },
        { key: 'r1', label: 'F.Grupos', kind: 'detail' },
        { key: 'r32', label: 'Dieciseisavos', kind: 'detail' },
        { key: 'r16', label: 'Octavos', kind: 'detail' },
        { key: 'qf', label: 'Cuartos', kind: 'detail' },
        { key: 'sf', label: 'Semis', kind: 'detail' },
        { key: 'finals', label: 'Finales', kind: 'detail' },
        ...scorerColumn,
      ];

  const sortIndicator = (colKey: SortColumn) => {
    if (sortColumn !== colKey) return '';
    return sortDirection === 'desc' ? ' ▼' : ' ▲';
  };

  const thStyle = (colKey: SortColumn): React.CSSProperties => ({
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    transition: 'color 0.2s, background 0.2s',
    background: sortColumn === colKey ? 'rgba(0, 210, 211, 0.15)' : 'transparent',
    color: sortColumn === colKey ? '#00d2d3' : 'inherit',
    borderBottom: sortColumn === colKey ? '2px solid #00d2d3' : undefined,
  });

  const columnClass = (col: LeaderboardColumn) => {
    if (col.kind === 'matchday') return 'lb-matchday-cell';
    if (col.kind === 'detail') return 'leaderboard-mobile-detail';
    return '';
  };

  const summaryMatchday = selectedMatchdayInfo || currentMatchday;

  return (
    <section id="view-leaderboard" className="view-section block">
      <div className="flex justify-center items-center gap-2.5 flex-nowrap mb-[25px] mt-2.5 max-w-full">
        <div
          role="tablist"
          aria-label="Vista de la clasificación"
          className="flex bg-[rgba(15,_23,_42,_0.8)] bg-none p-1 rounded-[16px] border border-[rgba(255,_255,_255,_0.12)] shadow-[0_8px_25px_rgba(0,_0,_0,_0.5),_inset_0_1px_0_rgba(255,_255,_255,_0.1)] [backdrop-filter:blur(12px)] relative gap-1"
        >
          <button
            className={`py-2 px-4.5 font-extrabold text-[0.95rem] border-none cursor-pointer rounded-[12px] [transition:all_0.25s_cubic-bezier(0.2,_0.8,_0.2,_1)] flex items-center gap-1.5 tracking-[0.5px] whitespace-nowrap ${activeTab === 'table' ? 'bg-[linear-gradient(135deg,_#00d2d3,_#01a3a4)] bg-transparent' : 'bg-transparent bg-none'} ${activeTab === 'table' ? 'text-black' : 'text-muted'} ${activeTab === 'table' ? 'shadow-[0_4px_15px_rgba(0,_210,_211,_0.4)]' : 'shadow-none'}`}
            type="button"
            onClick={() => setActiveTab('table')}
            role="tab"
            id="leaderboard-tab-table"
            aria-selected={activeTab === 'table'}
          >
            Ranking
          </button>
          <button
            className={`py-2 px-4.5 font-extrabold text-[0.95rem] border-none cursor-pointer rounded-[12px] [transition:all_0.25s_cubic-bezier(0.2,_0.8,_0.2,_1)] flex items-center gap-1.5 tracking-[0.5px] whitespace-nowrap ${activeTab === 'evolution' ? 'bg-[linear-gradient(135deg,_#ff9f43,_#ffaf60)] bg-transparent' : 'bg-transparent bg-none'} ${activeTab === 'evolution' ? 'text-black' : 'text-muted'} ${activeTab === 'evolution' ? 'shadow-[0_4px_15px_rgba(255,_159,_67,_0.4)]' : 'shadow-none'}`}
            type="button"
            onClick={() => setActiveTab('evolution')}
            role="tab"
            id="leaderboard-tab-evolution"
            aria-selected={activeTab === 'evolution'}
          >
            Gráfica
          </button>
        </div>
        <button
          className={`py-2 px-3.5 flex items-center justify-center bg-[linear-gradient(135deg,_#25D366,_#1ebd5a)] bg-transparent text-[#0f172a] border border-[rgba(255,_255,_255,_0.12)] rounded-[14px] shadow-[0_8px_25px_rgba(37,_211,_102,_0.3),_inset_0_1px_0_rgba(255,_255,_255,_0.2)] [backdrop-filter:blur(12px)] [transition:all_0.25s_cubic-bezier(0.2,_0.8,_0.2,_1)] min-h-11 min-w-11 shrink-0 ${sharing ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          id="btn-share-wa"
          onClick={handleShare}
          disabled={sharing}
          title="Compartir en WhatsApp"
          aria-label="Compartir en WhatsApp"
        >
          {sharing ? <span className="text-[1rem]">⏳</span> : <WhatsAppIcon size={24} />}
        </button>
      </div>

      {activeTab === 'evolution' ? (
        <div className="w-full mt-2.5">
          <Suspense fallback={<div className="skeleton-card h-100" />}>
            <EvolutionChart
              validResults={validResults}
              userName={userName}
              allGames={state.allGames}
            />
          </Suspense>
        </div>
      ) : (
        <>
          {isMatchday && summaryMatchday && (
            <div className="lb-matchday-panel">
              <div className="lb-matchday-summary">
                <div className="lb-matchday-heading">
                  <span className="lb-matchday-eyebrow">
                    <CalendarDays size={14} aria-hidden="true" />
                    {selectedMatchdayInfo?.current ? 'Jornada actual' : 'Jornada seleccionada'}
                  </span>
                  <div className="lb-matchday-title-row">
                    <strong className="lb-matchday-title">{summaryMatchday.label}</strong>
                    <span
                      className={`lb-matchday-status ${
                        summaryMatchday.finished ? 'is-finished' : 'is-live'
                      }`}
                    >
                      {summaryMatchday.finished ? 'Finalizada' : 'En juego'}
                    </span>
                  </div>
                  {summaryMatchday.matchCount > 0 && (
                    <span className="lb-matchday-meta">
                      {summaryMatchday.matchCount}{' '}
                      {summaryMatchday.matchCount === 1 ? 'partido' : 'partidos'}
                    </span>
                  )}
                </div>

                <div className="lb-matchday-kpis">
                  <div className="lb-matchday-kpi">
                    <span>Tus puntos</span>
                    <strong>{matchdayStats?.myPoints ?? 0}</strong>
                  </div>
                  <div className="lb-matchday-kpi">
                    <span>Líder de la jornada</span>
                    <strong>
                      {matchdayStats?.leader
                        ? `${matchdayStats.leader.name} · ${matchdayStats.leader.points.matchday} pts`
                        : 'Sin puntos todavía'}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="lb-matchday-nav">
                <button
                  type="button"
                  className="lb-matchday-step"
                  onClick={() => handleStepMatchday(-1)}
                  disabled={!canGoPrevMatchday}
                  aria-label="Jornada anterior"
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>

                <select
                  className="lb-matchday-select"
                  value={selectedMatchday || ''}
                  onChange={(event) => handleSelectMatchday(event.target.value)}
                  aria-label="Seleccionar jornada"
                >
                  {matchdays.map((matchday) => (
                    <option key={matchday.label} value={matchday.label}>
                      {matchday.label}
                      {matchday.current ? ' · actual' : ''}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="lb-matchday-step"
                  onClick={() => handleStepMatchday(1)}
                  disabled={!canGoNextMatchday}
                  aria-label="Jornada siguiente"
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-5 items-start flex-wrap justify-center w-full">
            <div className="table-container flex-1 min-w-75 max-w-350 my-0 mx-auto">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Participante</th>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className={columnClass(col)}
                        style={thStyle(col.key)}
                        onClick={() => handleSort(col.key)}
                        title={`Ordenar por ${col.label}`}
                        aria-label={col.shortLabel ? `Ordenar por ${col.label}` : undefined}
                      >
                        {col.shortLabel || col.label}
                        {sortIndicator(col.key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody id="leaderboard-body-tab">
                  {results.map((r) => {
                    const rankDisplay = rankLabel(r.rank, lowestPaidRank);

                    const isPending = !r.paid;
                    const isMe = r.userId?.toString() === userId?.toString() || r.name === userName;
                    const bgStyle = isMe
                      ? 'rgba(0, 210, 211, 0.15)'
                      : isPending
                        ? 'rgba(255, 165, 0, 0.05)'
                        : 'transparent';

                    const rowStyle = {
                      background: bgStyle,
                      boxShadow: isMe
                        ? 'inset 0 0 0 1px var(--accent-color), 0 0 15px rgba(0, 210, 211, 0.2)'
                        : 'none',
                      cursor: 'pointer',
                    };

                    return (
                      <tr key={r.key} style={rowStyle}>
                        <td className="text-[1.2em] text-center">{rankDisplay}</td>
                        <td>
                          <div className="flex justify-start items-center flex-nowrap gap-1.5">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <UserAvatar
                                url={r.avatarUrl}
                                userId={r.userId}
                                name={r.name}
                                size={28}
                              />
                              <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                                <span className="text-[1.1em]" title={`Ver Porra de ${r.name}`}>
                                  <strong>
                                    {r.name}
                                    {isMe && (
                                      <span className="text-accent-text ml-[5px] text-[0.8em]">
                                        (Tú)
                                      </span>
                                    )}
                                  </strong>
                                </span>
                                {isPending && (
                                  <span
                                    className="lb-unpaid-badge"
                                    title="Pago pendiente. El administrador debe marcarlo como pagado para mostrar sus puntos."
                                  >
                                    Sin pagar
                                  </span>
                                )}
                              </div>
                            </div>

                            {r.id != null && (
                              <button
                                className="glass-btn bg-[rgba(56,_173,_246,_0.2)] bg-none text-[#38adf6] border border-[#38adf6] py-[5px] px-[7px] min-w-8.5 min-h-8.5 ml-auto shrink-0 text-[0.95rem] leading-[1] inline-flex items-center justify-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isMatchday) {
                                    navigate('/jornadas');
                                  } else {
                                    state.setViewerPredictionId(r.id);
                                  }
                                }}
                                title={isMatchday ? 'Ver partidos de la jornada' : 'Ver Porra'}
                              >
                                <span aria-hidden="true">👁️</span>
                                <span className="sr-only">
                                  {isMatchday ? 'Ver jornadas' : 'Ver porra'}
                                </span>
                              </button>
                            )}
                          </div>
                        </td>
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            className={columnClass(col)}
                            style={
                              col.kind === 'total'
                                ? {
                                    color: 'var(--accent-text)',
                                    fontWeight: 'bold',
                                    fontSize: '1.1em',
                                    textAlign: 'center',
                                  }
                                : undefined
                            }
                          >
                            {col.kind === 'total' ? (
                              <span className="lb-total-value">
                                {r.paid ? `${r.points.total ?? 0} pts` : '-'}
                              </span>
                            ) : r.paid ? (
                              `${r.points[col.key] ?? 0}`
                            ) : (
                              '-'
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* SHARE IMAGE TEMPLATE (Hidden) */}
      <div
        className="absolute -top-[9999px] -left-[9999px] w-200 p-7.5 bg-[#0f0f1a] bg-none text-white box-border rounded-[15px]"
        id="share-image-template"
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        <div className="text-center mb-5 border-b-2 border-b-[#00d2d3] pb-2.5">
          <h1 className="text-[#00d2d3] m-0 text-[28px] uppercase">
            🏆{' '}
            {state.activeCompetitionName ? `Porra ${state.activeCompetitionName}` : 'Porra Oficial'}
          </h1>
          <p className="text-[#ff9f43] mt-[5px] mb-0 mx-0 text-[18px] font-bold">
            Clasificación: {activeGroupName}
          </p>
        </div>
        <div className="flex gap-5 justify-between" id="share-image-columns">
          <div className="flex-1 flex flex-col gap-2" id="share-col-left">
            {validResults.slice(0, mid).map((r) => {
              const rankDisplay = rankLabel(r.rank, lowestPaidRank);

              const isMe = r.name === userName;
              return (
                <div
                  className={`flex items-center justify-between py-2 px-3 rounded-[8px] ${isMe ? 'bg-[rgba(0,_210,_211,_0.15)] bg-none' : 'bg-[rgba(255,255,255,0.05)] bg-none'} ${isMe ? 'border border-[#00d2d3]' : 'border border-[rgba(255,255,255,0.05)]'}`}
                  key={r.key}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[1.2rem] font-bold w-7.5 text-center text-accent-text">
                      {rankDisplay}
                    </span>
                    <span className="text-[1.1rem] font-bold text-white">{r.name}</span>
                  </div>
                  <span className="text-[1.2rem] font-bold text-[#00d2d3]">
                    {r.points.total} pts
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex-1 flex flex-col gap-2" id="share-col-right">
            {validResults.slice(mid).map((r) => {
              const rankDisplay = rankLabel(r.rank, lowestPaidRank);

              const isMe = r.name === userName;
              return (
                <div
                  className={`flex items-center justify-between py-2 px-3 rounded-[8px] ${isMe ? 'bg-[rgba(0,_210,_211,_0.15)] bg-none' : 'bg-[rgba(255,255,255,0.05)] bg-none'} ${isMe ? 'border border-[#00d2d3]' : 'border border-[rgba(255,255,255,0.05)]'}`}
                  key={r.key}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[1.2rem] font-bold w-7.5 text-center text-accent-text">
                      {rankDisplay}
                    </span>
                    <span className="text-[1.1rem] font-bold text-white">{r.name}</span>
                  </div>
                  <span className="text-[1.2rem] font-bold text-[#00d2d3]">
                    {r.points.total} pts
                  </span>
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
