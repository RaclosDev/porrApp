import MatchdayPodium, { podiumPlaces } from '../components/MatchdayPodium';
import PaperLoading from '../components/PaperLoading';
import React, { useState, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Search, Share2 } from 'lucide-react';
import { useLeaderboard, type SortColumn } from '../hooks/useLeaderboard';

interface LeaderboardColumn {
  key: SortColumn;
  label: string;
  shortLabel?: string;
  kind: 'total' | 'matchday' | 'detail';
}
const EvolutionChart = React.lazy(() => import('../components/EvolutionChart'));
import { UserAvatar } from '../components/Avatar';
import StickerCard from '../components/StickerCard';

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

/** Clasificación de la liga activa (tabla y gráfica). */
/** La fila es del usuario: por id cuando las dos partes lo tienen y, si no, por nombre. */
function isOwnRow(
  row: { userId?: number | string | null; name?: string },
  userId: number | string | null | undefined,
  userName: string | null | undefined,
): boolean {
  if (row.userId != null && userId != null) return String(row.userId) === String(userId);
  return Boolean(userName) && row.name === userName;
}

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
  const [activeTab, setActiveTab] = useState<'table' | 'evolution'>('table');
  // En móvil el desglose por fase va oculto hasta que se pide.
  const [showDetail, setShowDetail] = useState(false);

  const isMatchday =
    activeGroupPoolFormat === 'MATCH_DAY' || state.activeCompetitionFormatType === 'LEAGUE';

  // Mismo podio en todos los formatos: los empates comparten cromo en vez de ocultar el podio.
  const sharePodium = React.useMemo(() => {
    return podiumPlaces(validResults).map(({ score, leaders: members }, index) => {
      const first = members[0];
      return {
        leader: {
          rank: index + 1,
          name: members.length === 1 ? first.name : 'Empate',
          userId: first.userId,
          avatarUrl: first.avatarUrl,
          total: score,
        },
        members,
      };
    });
  }, [validResults]);

  if (loading) return <PaperLoading label="Cargando clasificación" />;

  const showSharePodium = sharePodium.length > 0;
  const shareRows = validResults.filter(
    (row) => !sharePodium.some(({ leader }) => leader.total === row.points.total),
  );
  const shareMid = Math.ceil(shareRows.length / 2);

  const scorerColumn: LeaderboardColumn[] = activeGroupPichichi
    ? [{ key: 'scorer', label: 'Pichichi', kind: 'detail' }]
    : [];
  const columns: LeaderboardColumn[] = isMatchday
    ? [
        { key: 'total', label: 'Total', kind: 'total' },
        selectedMatchday
          ? {
              key: 'matchday',
              label: selectedMatchday,
              shortLabel: compactMatchdayLabel(selectedMatchday),
              kind: 'matchday',
            }
          : { key: 'matchPoints', label: 'Puntos de jornada', kind: 'detail' },
        ...scorerColumn,
      ]
    : state.activeGroupOwnBracket
      ? [
          { key: 'total', label: 'Total', kind: 'total' },
          { key: 'r1', label: 'Grupos', kind: 'detail' },
          { key: 'r32', label: 'Cuadro', kind: 'detail' },
        ]
      : [
          { key: 'total', label: 'Total', kind: 'total' },
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
    userSelect: 'none',
    whiteSpace: 'nowrap',
    transition: 'color 0.2s, background 0.2s',
    background: 'transparent',
    color: 'inherit',
    borderBottom: sortColumn === colKey ? '3px solid var(--ink)' : undefined,
  });

  const columnClass = (col: LeaderboardColumn) => {
    if (col.kind === 'matchday') return 'lb-matchday-cell';
    if (col.kind === 'detail' && !isMatchday) return 'leaderboard-mobile-detail';
    return '';
  };

  const summaryMatchday = selectedMatchdayInfo || currentMatchday;

  return (
    <section id="view-leaderboard" className="view-section block">
      {!isMatchday && (
        <div className="ranking-toolbar">
          {!isMatchday && (
            <div
              role="tablist"
              aria-label="Vista de la clasificación"
              className="ranking-view-tabs"
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? 'table'
                    : event.key === 'End'
                      ? 'evolution'
                      : activeTab === 'table'
                        ? 'evolution'
                        : 'table';
                setActiveTab(next);
                document.getElementById(`leaderboard-tab-${next}`)?.focus();
              }}
            >
              <button
                className={`ranking-view-tab ${activeTab === 'table' ? 'is-active' : ''}`}
                type="button"
                onClick={() => setActiveTab('table')}
                role="tab"
                id="leaderboard-tab-table"
                aria-selected={activeTab === 'table'}
                aria-controls="leaderboard-panel"
                tabIndex={activeTab === 'table' ? 0 : -1}
              >
                Ranking
              </button>
              <button
                className={`ranking-view-tab ${activeTab === 'evolution' ? 'is-active' : ''}`}
                type="button"
                onClick={() => setActiveTab('evolution')}
                role="tab"
                id="leaderboard-tab-evolution"
                aria-selected={activeTab === 'evolution'}
                aria-controls="leaderboard-panel"
                tabIndex={activeTab === 'evolution' ? 0 : -1}
              >
                Gráfica
              </button>
            </div>
          )}
          {/* Más elegidos y Buscador comparan con el Mundial: no aplican a los cuadros propios. */}
          {(isMatchday || !state.activeGroupOwnBracket) && (
            <nav aria-label="Estadísticas de la liga" className="ranking-secondary-links">
              <Link to="/stats" className="ranking-secondary-link">
                <BarChart3 size={16} aria-hidden="true" />
                {isMatchday ? 'Estadísticas por partido' : 'Más elegidos'}
              </Link>
              {!isMatchday && (
                <Link to="/search" className="ranking-secondary-link">
                  <Search size={16} aria-hidden="true" />
                  Buscador
                </Link>
              )}
            </nav>
          )}
          <button
            className="ranking-share-button"
            id="btn-share-wa"
            onClick={handleShare}
            disabled={sharing}
            title="Compartir clasificación"
            aria-label="Compartir clasificación"
            aria-busy={sharing}
          >
            <Share2 size={20} aria-hidden="true" />
            <span className="ml-2">{sharing ? 'Generando…' : 'Compartir'}</span>
          </button>
        </div>
      )}

      <div
        id="leaderboard-panel"
        role={isMatchday ? 'region' : 'tabpanel'}
        aria-label={isMatchday ? 'Clasificación' : undefined}
        aria-labelledby={isMatchday ? undefined : `leaderboard-tab-${activeTab}`}
        tabIndex={isMatchday ? undefined : 0}
      >
        {!isMatchday && activeTab === 'evolution' ? (
          <div className="w-full mt-2.5">
            <Suspense fallback={<PaperLoading label="Cargando gráfica" />}>
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
              <div className="lb-matchday-panel paper-panel album-sheet">
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
                <div className="lb-matchday-footer">
                  <span>
                    Tus puntos en esta jornada <strong>{matchdayStats?.myPoints ?? 0}</strong>
                  </span>
                  <Link to="/stats" aria-label="Estadísticas por partido">
                    <BarChart3 size={16} aria-hidden="true" /> Estadísticas
                  </Link>
                </div>
              </div>
            )}

            {!isMatchday && <MatchdayPodium rows={results} />}
            <div className="flex gap-5 items-start flex-wrap justify-center w-full">
              <div
                className={`table-container paper-panel album-sheet flex-1 min-w-75 max-w-350 my-0 mx-auto ${showDetail ? 'show-detail' : ''}`}
              >
                {isMatchday && (
                  <>
                    <div className="matchday-ranking-heading">
                      <h2 className="poster-title">Clasificación general</h2>
                      <button
                        type="button"
                        className="matchday-ranking-share"
                        onClick={handleShare}
                        disabled={sharing}
                        aria-busy={sharing}
                        aria-label="Compartir clasificación"
                      >
                        <Share2 size={18} aria-hidden="true" />
                        <span>{sharing ? 'Generando…' : 'Compartir'}</span>
                      </button>
                    </div>
                    <MatchdayPodium rows={results} />
                    {!summaryMatchday && (
                      <Link className="ranking-secondary-link" to="/stats">
                        Estadísticas por partido
                      </Link>
                    )}
                  </>
                )}
                {!isMatchday && (
                  <button
                    type="button"
                    className="lb-detail-toggle glass-btn py-1.5 px-3 text-[0.8rem]"
                    aria-pressed={showDetail}
                    onClick={() => setShowDetail((v) => !v)}
                  >
                    {showDetail ? 'Ocultar desglose' : 'Ver desglose por fase'}
                  </button>
                )}
                <div className="ranking-table-scroll">
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
                            aria-sort={
                              sortColumn === col.key
                                ? sortDirection === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                          >
                            <button
                              type="button"
                              className="leaderboard-sort-button"
                              onClick={() => handleSort(col.key)}
                              title={`Ordenar por ${col.label}`}
                              aria-label={`Ordenar por ${col.label}`}
                            >
                              {col.shortLabel || col.label}
                              <span aria-hidden="true">{sortIndicator(col.key)}</span>
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody id="leaderboard-body-tab">
                      {results.length === 0 && (
                        <tr>
                          <td colSpan={columns.length + 2}>
                            <p role="status" className="py-6 text-muted">
                              Todavía no hay participantes en la clasificación.
                            </p>
                          </td>
                        </tr>
                      )}
                      {results.map((r) => {
                        const rankDisplay = rankLabel(r.rank, lowestPaidRank);

                        const isPending = !r.paid;
                        const isMe = isOwnRow(r, userId, userName);
                        const bgStyle = isMe
                          ? 'rgba(11, 95, 116, 0.08)'
                          : isPending
                            ? 'rgba(255, 165, 0, 0.05)'
                            : 'transparent';

                        const rowStyle = {
                          background: bgStyle,
                          boxShadow: isMe ? 'inset 0 0 0 1px var(--accent-color)' : 'none',
                        };

                        return (
                          <tr
                            key={r.key}
                            style={r.id != null ? { ...rowStyle, cursor: 'pointer' } : rowStyle}
                            onClick={
                              r.id != null
                                ? () => {
                                    if (isMatchday) {
                                      navigate('/jornadas');
                                    } else {
                                      state.setViewerPredictionId(r.id);
                                    }
                                  }
                                : undefined
                            }
                          >
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
                                    <span className="text-[1.1em]">
                                      <strong>
                                        {r.name}
                                        {isMe && (
                                          <span className="text-accent-text ml-[5px] text-[0.8em] whitespace-nowrap">
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
                                    className="glass-btn bg-[rgba(11,_95,_116,_0.08)] bg-none text-accent-text border border-accent py-[5px] px-[7px] min-w-11 min-h-11 ml-auto shrink-0 whitespace-nowrap text-[0.95rem] leading-[1] inline-flex items-center justify-center"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isMatchday) {
                                        navigate('/jornadas');
                                      } else {
                                        state.setViewerPredictionId(r.id);
                                      }
                                    }}
                                    title={isMatchday ? 'Ver partidos de la jornada' : 'Ver porra'}
                                  >
                                    <span
                                      aria-hidden="true"
                                      className="poster-title text-[0.75rem]"
                                    >
                                      Ver
                                    </span>
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
            </div>
          </>
        )}
      </div>

      {/* Plantilla de la imagen compartida; queda fuera de los paneles visibles. */}
      <div
        className="absolute -top-[9999px] -left-[9999px] w-200 p-7.5 paper-panel bg-[var(--paper)] bg-none text-main box-border rounded-[4px]"
        id="share-image-template"
        aria-hidden="true"
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        <div className="text-center mb-5 border-b-2 border-b-[var(--ink)] pb-2.5">
          <h1 className="text-accent-text m-0 text-[28px] uppercase">
            🏆 {state.activeCompetitionName ? `Porra ${state.activeCompetitionName}` : 'PorrApp'}
          </h1>
          <p className="text-muted mt-[5px] mb-0 mx-0 text-[18px] font-bold">
            Clasificación: {activeGroupName}
          </p>
        </div>
        {showSharePodium && (
          <ul className="ranking-podium share-image-podium" aria-label="Podio de la clasificación">
            {sharePodium.map(({ leader, members }) => (
              <li
                className={`ranking-podium-place ranking-podium-place-${leader.rank}`}
                key={`${leader.rank}-${leader.total}`}
              >
                <StickerCard
                  leader={leader}
                  featured={leader.rank === 1}
                  compact
                  staticCard
                  className="share-image-podium-card"
                >
                  {members.length > 1 && (
                    <div className="share-image-podium-tie">
                      <div className="matchday-podium-avatars" aria-hidden="true">
                        {members.slice(0, 3).map((member) => (
                          <UserAvatar
                            key={member.key}
                            url={member.avatarUrl}
                            userId={member.userId}
                            name={member.name}
                            size={32}
                          />
                        ))}
                      </div>
                      <span>{members.map((member) => member.name).join(' · ')}</span>
                    </div>
                  )}
                </StickerCard>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-5 justify-between" id="share-image-columns">
          <div className="flex-1 flex flex-col gap-2" id="share-col-left">
            {shareRows.slice(0, shareMid).map((r) => {
              const rankDisplay = rankLabel(r.rank, lowestPaidRank);

              const isMe = isOwnRow(r, userId, userName);
              return (
                <div
                  data-share-row
                  className={`share-image-ranking-row flex items-center justify-between py-2 px-3 rounded-[8px] ${isMe ? 'bg-[rgba(11,_95,_116,_0.08)] bg-none border border-accent' : 'bg-panel bg-none border border-line'}`}
                  key={r.key}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[1.2rem] font-bold w-7.5 text-center text-accent-text">
                      {rankDisplay}
                    </span>
                    <span className="text-[1.1rem] font-bold text-main">{r.name}</span>
                  </div>
                  <span className="text-[1.2rem] font-bold text-accent-text">
                    {r.points.total} pts
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex-1 flex flex-col gap-2" id="share-col-right">
            {shareRows.slice(shareMid).map((r) => {
              const rankDisplay = rankLabel(r.rank, lowestPaidRank);

              const isMe = isOwnRow(r, userId, userName);
              return (
                <div
                  data-share-row
                  className={`share-image-ranking-row flex items-center justify-between py-2 px-3 rounded-[8px] ${isMe ? 'bg-[rgba(11,_95,_116,_0.08)] bg-none border border-accent' : 'bg-panel bg-none border border-line'}`}
                  key={r.key}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[1.2rem] font-bold w-7.5 text-center text-accent-text">
                      {rankDisplay}
                    </span>
                    <span className="text-[1.1rem] font-bold text-main">{r.name}</span>
                  </div>
                  <span className="text-[1.2rem] font-bold text-accent-text">
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
