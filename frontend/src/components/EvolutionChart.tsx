import React, { useState, useMemo } from 'react';
import type { LeaderboardRow } from '../hooks/useLeaderboard';
import type { Match } from '../types/api';

/** Punto del eje X: una ronda o un partido de eliminatoria. */
interface ChartStage {
  key: string;
  label: string;
  roundName: string;
  showLabel: boolean;
  isRoundBoundary: boolean;
  matchTitle?: string;
  matchTime?: string;
  /** Campo de ParticipantScore con los puntos de la ronda. */
  prop?: string;
  home?: string;
  away?: string;
  /** Índice del partido de eliminatoria (0-31). */
  mIdx?: number;
}

/** Serie de un participante en el gráfico. */
interface ChartUser {
  key: number | string;
  name: string;
  isMe: boolean;
  color: string;
  pointsEvolution: number[];
  rankEvolution: number[];
  totalPoints: number;
}

interface EvolutionChartProps {
  validResults: LeaderboardRow[];
  userName: string;
  allGames: Match[];
}

const STAGES = [
  { key: 'r1', label: 'F.Grupos', prop: 'r1' },
  { key: 'r32', label: 'Dieciseisavos', prop: 'r32' },
  { key: 'r16', label: 'Octavos', prop: 'r16' },
  { key: 'qf', label: 'Cuartos', prop: 'qf' },
  { key: 'sf', label: 'Semis', prop: 'sf' },
  { key: 'finals', label: 'Finales', prop: 'finals' },
  { key: 'total', label: 'Total', prop: 'scorer' },
];

const PALETTE = [
  '#00d2d3',
  '#ff9f43',
  '#ff4757',
  '#2ecc71',
  '#38adf6',
  '#9b59b6',
  '#f1c40f',
  '#e67e22',
  '#e74c3c',
  '#1abc9c',
  '#3498db',
  '#8e44ad',
  '#ff6b81',
  '#7bed9f',
  '#70a1ff',
  '#5352ed',
  '#ffa502',
  '#ff6348',
];

export default function EvolutionChart({ validResults, userName, allGames }: EvolutionChartProps) {
  const [mode, setMode] = useState('rank'); // 'rank' | 'points'
  const [timeScale, setTimeScale] = useState('rounds'); // 'rounds' | 'matches'
  const [hoveredUser, setHoveredUser] = useState(null);
  const [hoveredStageIdx, setHoveredStageIdx] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1); // Zoom horizontal de 0.75 a 3.5

  // Default selected: all if <= 10, otherwise top 8 + current user
  const defaultSelected = useMemo(() => {
    if (!validResults || validResults.length === 0) return {};
    const sel = {};
    validResults.forEach((r, idx) => {
      const isMe = r.name === userName;
      if (validResults.length <= 10 || idx < 8 || isMe) {
        sel[r.key] = true;
      } else {
        sel[r.key] = false;
      }
    });
    return sel;
  }, [validResults, userName]);

  const [selectedUsers, setSelectedUsers] = useState(defaultSelected);

  React.useEffect(() => {
    if (Object.keys(selectedUsers).length === 0 && validResults.length > 0) {
      setTimeout(() => setSelectedUsers(defaultSelected), 0);
    }
  }, [defaultSelected, selectedUsers, validResults.length]);

  const toggleUser = (key) => {
    setSelectedUsers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = () => {
    const sel = {};
    validResults.forEach((r) => (sel[r.key] = true));
    setSelectedUsers(sel);
  };

  const selectNone = () => {
    const sel = {};
    validResults.forEach((r) => (sel[r.key] = false));
    setSelectedUsers(sel);
  };

  const selectTopN = (n) => {
    const sel = {};
    validResults.forEach((r, idx) => {
      sel[r.key] = idx < n || r.name === userName;
    });
    setSelectedUsers(sel);
  };

  // Build active stages array depending on timeScale.
  // CRITICAL: Never include Inicio (r0). Always end EXACTLY at the last round/match actually played/scored.
  const activeStages = useMemo((): ChartStage[] => {
    if (timeScale === 'rounds') {
      const allRounds = STAGES.map((st) => ({
        ...st,
        showLabel: true,
        roundName:
          st.label === 'F.Grupos'
            ? 'Fase de Grupos'
            : st.label === 'Dieciseisavos'
              ? '1/16 de Final'
              : st.label === 'Octavos'
                ? 'Octavos de Final'
                : st.label,
        matchTitle: null,
        matchTime: null,
        isRoundBoundary: true,
      }));
      if (!validResults || validResults.length === 0) return allRounds.slice(0, 1);

      let lastPlayedIdx = 0; // F.Grupos por defecto (índice 0)
      allRounds.forEach((st, idx) => {
        if (idx === 0) return;
        const hasPts = validResults.some((r) => Number(r.points[st.prop]) > 0);
        let hasMatches = false;
        if (allGames && allGames.length > 0) {
          if (st.key === 'r32' || st.key === 'r16') {
            hasMatches = allGames.some(
              (g) =>
                (g.round === 'r32' || g.round === 'r16' || g.round === '32' || g.round === '16') &&
                (g.finished || g.winner || g.home_score != null),
            );
          } else if (st.key === 'qf') {
            hasMatches = allGames.some(
              (g) =>
                (g.round === 'qf' || g.round === 'quarter') &&
                (g.finished || g.winner || g.home_score != null),
            );
          } else if (st.key === 'sf') {
            hasMatches = allGames.some(
              (g) =>
                (g.round === 'sf' || g.round === 'semi') &&
                (g.finished || g.winner || g.home_score != null),
            );
          } else if (st.key === 'finals' || st.key === 'total') {
            hasMatches = allGames.some(
              (g) =>
                (g.round === 'final' || g.round === 'third') &&
                (g.finished || g.winner || g.home_score != null),
            );
          }
        }
        if (hasPts || hasMatches) lastPlayedIdx = idx;
      });

      // El último eje debe ser SIEMPRE el del último dato disputado/evaluado
      const limitIdx = Math.min(Math.max(lastPlayedIdx + 1, 1), allRounds.length);
      return allRounds.slice(0, limitIdx);
    }

    // Match-by-match mode starting directly at Grupos (sin Inicio)
    const list: ChartStage[] = [
      {
        key: 'r1',
        label: 'Grupos',
        roundName: 'Fase de Grupos',
        showLabel: true,
        isRoundBoundary: true,
        matchTitle: 'Puntuación tras Fase de Grupos',
        matchTime: '',
      },
    ];

    const ko = (allGames || [])
      .filter((g) => g && g.round !== 'group' && g.round !== 'r1')
      .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

    // Find the last played knockout match index without buggy date checks
    let lastPlayedKoIdx = -1;
    const maxKo = Math.max(ko.length, 32);
    for (let i = 0; i < maxKo; i++) {
      if (i >= ko.length) break;
      const g = ko[i];
      const isPlayed = g.finished || g.winner || g.home_score != null;
      if (isPlayed) {
        lastPlayedKoIdx = i;
      }
    }

    // Strictly limit to the match that has been played or reached
    const limitKo = Math.max(lastPlayedKoIdx + 1, 0);

    for (let i = 0; i < limitKo; i++) {
      if (i >= ko.length) break;
      const g = ko[i];

      let realRoundName = '1/16 de Final';
      let shortLabel = '1/16';
      if (i >= 30) {
        realRoundName = 'Final / 3er Puesto';
        shortLabel = 'Finales';
      } else if (i >= 28) {
        realRoundName = 'Semifinales';
        shortLabel = 'Semis';
      } else if (i >= 24) {
        realRoundName = 'Cuartos de Final';
        shortLabel = 'Cuartos';
      } else if (i >= 16) {
        realRoundName = 'Octavos de Final';
        shortLabel = 'Octavos';
      }

      let showLabel = false;
      let isBoundary = false;

      if (i < 16) {
        const spanEnd = Math.min(limitKo, 16);
        if (i === Math.floor((spanEnd - 1) / 2)) showLabel = true;
        if (i === 15) isBoundary = true;
      } else if (i < 24) {
        const spanEnd = Math.min(limitKo, 24);
        if (i === 16 + Math.floor((spanEnd - 17) / 2)) showLabel = true;
        if (i === 23) isBoundary = true;
      } else if (i < 28) {
        const spanEnd = Math.min(limitKo, 28);
        if (i === 24 + Math.floor((spanEnd - 25) / 2)) showLabel = true;
        if (i === 27) isBoundary = true;
      } else if (i < 30) {
        const spanEnd = Math.min(limitKo, 30);
        if (i === 28 + Math.floor((spanEnd - 29) / 2)) showLabel = true;
        if (i === 29) isBoundary = true;
      } else {
        const spanEnd = Math.min(limitKo, 32);
        if (i === 30 + Math.floor((spanEnd - 31) / 2)) showLabel = true;
        if (i === 31) isBoundary = true;
      }

      const home = g.home || 'Por definir';
      const away = g.away || 'Por definir';
      const timeStr = g.date
        ? new Date(g.date).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';

      list.push({
        key: `ko-${i}`,
        label: shortLabel,
        roundName: realRoundName,
        showLabel: showLabel,
        isRoundBoundary: isBoundary,
        matchTitle: `${home} vs ${away}`,
        matchTime: timeStr,
        home: home,
        away: away,
        mIdx: i,
      });
    }

    // Only append Total if the tournament is completely finished (all 32 knockout matches played)
    if (lastPlayedKoIdx >= 31) {
      list.push({
        key: 'total',
        label: 'Total',
        roundName: 'Clasificación Final',
        showLabel: true,
        isRoundBoundary: true,
        matchTitle: 'Clasificación Final',
        matchTime: '',
      });
    }
    return list;
  }, [timeScale, allGames, validResults]);

  // Calculate cumulative points, rank, and smart Y-axis zoom based on selected users
  const evolutionData = useMemo(() => {
    if (!validResults || validResults.length === 0)
      return { users: [], yMin: 0, yMax: 100, yGridLines: [0, 25, 50, 75, 100], maxRank: 1 };

    const usersMap: Record<string, ChartUser> = {};
    validResults.forEach((r, idx) => {
      usersMap[r.key] = {
        key: r.key,
        name: r.name,
        isMe: r.name === userName,
        color: PALETTE[idx % PALETTE.length],
        pointsEvolution: [],
        rankEvolution: [],
        totalPoints: Number(r.points?.total) || 0,
      };
    });

    if (timeScale === 'rounds') {
      validResults.forEach((r) => {
        let cum = 0;
        const ptsList = [];
        activeStages.forEach((st) => {
          if (st.key === 'total') {
            cum = Number(r.points.total) || 0;
          } else if (st.prop) {
            cum += Number(r.points[st.prop]) || 0;
          }
          ptsList.push(cum);
        });
        while (ptsList.length < activeStages.length) {
          ptsList.push(ptsList[ptsList.length - 1] || 0);
        }
        usersMap[r.key].pointsEvolution = ptsList;
      });
    } else {
      validResults.forEach((r) => {
        const ptsList = [Number(r.points.r1) || 0];
        let currentKoCum = ptsList[0];

        const koStages = activeStages.filter((st) => st.key !== 'r1' && st.key !== 'total');
        const logs = (r.points.log || []).map((l) => ({ ...l, used: false }));

        koStages.forEach((st) => {
          let stageType = 'r32';
          if (st.mIdx >= 30) stageType = 'finals';
          else if (st.mIdx >= 28) stageType = 'sf';
          else if (st.mIdx >= 24) stageType = 'qf';
          else if (st.mIdx >= 16) stageType = 'r16';

          logs.forEach((l) => {
            if (!l.used && l.stage === stageType && l.msg) {
              const msgLow = l.msg.toLowerCase();
              const hLow = (st.home || '').toLowerCase();
              const aLow = (st.away || '').toLowerCase();
              if (
                (hLow && hLow !== 'por definir' && msgLow.includes(hLow)) ||
                (aLow && aLow !== 'por definir' && msgLow.includes(aLow))
              ) {
                l.used = true;
                currentKoCum += Number(l.amount) || 0;
              }
            }
          });

          if (st.mIdx === 15)
            currentKoCum = (Number(r.points.r1) || 0) + (Number(r.points.r32) || 0);
          else if (st.mIdx === 23)
            currentKoCum =
              (Number(r.points.r1) || 0) +
              (Number(r.points.r32) || 0) +
              (Number(r.points.r16) || 0);
          else if (st.mIdx === 27)
            currentKoCum =
              (Number(r.points.r1) || 0) +
              (Number(r.points.r32) || 0) +
              (Number(r.points.r16) || 0) +
              (Number(r.points.qf) || 0);
          else if (st.mIdx === 29)
            currentKoCum =
              (Number(r.points.r1) || 0) +
              (Number(r.points.r32) || 0) +
              (Number(r.points.r16) || 0) +
              (Number(r.points.qf) || 0) +
              (Number(r.points.sf) || 0);
          else if (st.mIdx === 31)
            currentKoCum =
              (Number(r.points.r1) || 0) +
              (Number(r.points.r32) || 0) +
              (Number(r.points.r16) || 0) +
              (Number(r.points.qf) || 0) +
              (Number(r.points.sf) || 0) +
              (Number(r.points.finals) || 0);

          ptsList.push(currentKoCum);
        });

        if (activeStages[activeStages.length - 1]?.key === 'total') {
          ptsList.push(Number(r.points.total) || 0);
        }

        while (ptsList.length < activeStages.length) {
          ptsList.push(ptsList[ptsList.length - 1] || 0);
        }

        usersMap[r.key].pointsEvolution = ptsList;
      });
    }

    // Calculate ranks at each stage
    let maxRk = 1;
    const numStages = activeStages.length;
    for (let i = 0; i < numStages; i++) {
      const stageSorted = [...validResults].sort((a, b) => {
        const ptsA = usersMap[a.key].pointsEvolution[i] || 0;
        const ptsB = usersMap[b.key].pointsEvolution[i] || 0;
        if (ptsB !== ptsA) return ptsB - ptsA;
        return (b.points.total || 0) - (a.points.total || 0);
      });

      let currentRank = 1;
      let prevPts = null;
      stageSorted.forEach((r) => {
        const pts = usersMap[r.key].pointsEvolution[i] || 0;
        if (prevPts !== null && pts !== prevPts) {
          currentRank++;
        }
        usersMap[r.key].rankEvolution[i] = currentRank;
        prevPts = pts;
        if (currentRank > maxRk) maxRk = currentRank;
      });
    }

    // Smart vertical zoom: calculate min/max points ONLY across selected participants
    let minPts = Infinity;
    let maxPts = -Infinity;
    const anySelected = Object.values(selectedUsers).some(Boolean);

    Object.values(usersMap).forEach((u) => {
      if (anySelected && !selectedUsers[u.key]) return;
      u.pointsEvolution.forEach((pts) => {
        if (pts < minPts) minPts = pts;
        if (pts > maxPts) maxPts = pts;
      });
    });

    if (minPts === Infinity || maxPts === -Infinity) {
      minPts = 0;
      maxPts = 100;
    }

    const rawRange = Math.max(maxPts - minPts, 10);
    let step;
    if (rawRange <= 20) step = 5;
    else if (rawRange <= 50) step = 10;
    else if (rawRange <= 120) step = 25;
    else if (rawRange <= 250) step = 50;
    else if (rawRange <= 600) step = 100;
    else step = 200;

    const yMin = Math.floor(minPts / step) * step;
    let yMax = Math.ceil(maxPts / step) * step;
    if (yMax <= yMin) yMax = yMin + step;

    const yGridLines = [];
    for (let v = yMin; v <= yMax; v += step) {
      yGridLines.push(v);
    }

    return {
      users: Object.values(usersMap),
      yMin,
      yMax,
      yGridLines,
      maxRank: Math.max(maxRk, 2),
    };
  }, [validResults, userName, timeScale, activeStages, selectedUsers]);

  const { users, yMin, yMax, yGridLines, maxRank } = evolutionData;

  const width = 1100;
  const height = 350;
  const padding = { top: 35, right: 45, bottom: 45, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const getX = (idx) => padding.left + (idx / Math.max(activeStages.length - 1, 1)) * chartW;

  const getY = (val, isRank) => {
    if (isRank) {
      if (maxRank === 1) return padding.top + chartH / 2;
      return padding.top + ((val - 1) / (maxRank - 1)) * chartH;
    } else {
      const range = Math.max(yMax - yMin, 1);
      return padding.top + chartH - ((val - yMin) / range) * chartH;
    }
  };

  const currentInspectedStage = hoveredStageIdx !== null ? activeStages[hoveredStageIdx] : null;

  return (
    <div
      style={{
        background: 'rgba(15, 15, 26, 0.8)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '20px 14px',
        margin: '0 auto',
        width: '100%',
        maxWidth: '1400px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        boxSizing: 'border-box',
      }}
    >
      {/* Header & Mode/Scale Toggles */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px',
          marginBottom: '16px',
          padding: '0 4px',
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '1.4rem',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>📈 Gráfica de Evolución</span>
            {mode === 'rank' && (
              <span
                style={{
                  fontSize: '0.8rem',
                  background: 'rgba(0, 210, 211, 0.2)',
                  color: '#00d2d3',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid #00d2d3',
                }}
              >
                Ranking
              </span>
            )}
            {mode === 'points' && (
              <span
                style={{
                  fontSize: '0.8rem',
                  background: 'rgba(255, 159, 67, 0.2)',
                  color: '#ff9f43',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid #ff9f43',
                }}
              >
                Puntos
              </span>
            )}
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Horizontal Zoom Controls */}
          <div
            style={{
              display: 'flex',
              gap: '2px',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '3px',
              borderRadius: '25px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              alignItems: 'center',
            }}
          >
            <button
              onClick={() => setZoomLevel((prev) => Math.max(prev - 0.25, 0.75))}
              disabled={zoomLevel <= 0.75}
              style={{
                padding: '5px 10px',
                borderRadius: '16px',
                border: 'none',
                cursor: zoomLevel <= 0.75 ? 'not-allowed' : 'pointer',
                background: 'transparent',
                color: zoomLevel <= 0.75 ? '#555' : '#fff',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                transition: 'all 0.2s',
              }}
              title="Reducir zoom horizontal"
            >
              🔍-
            </button>
            <span
              style={{
                fontSize: '0.75rem',
                color: '#ccc',
                padding: '0 4px',
                fontWeight: 'bold',
                minWidth: '42px',
                textAlign: 'center',
                userSelect: 'none',
              }}
            >
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((prev) => Math.min(prev + 0.35, 3.5))}
              disabled={zoomLevel >= 3.5}
              style={{
                padding: '5px 10px',
                borderRadius: '16px',
                border: 'none',
                cursor: zoomLevel >= 3.5 ? 'not-allowed' : 'pointer',
                background: 'transparent',
                color: zoomLevel >= 3.5 ? '#555' : '#fff',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                transition: 'all 0.2s',
              }}
              title="Aumentar zoom horizontal"
            >
              🔍+
            </button>
            {zoomLevel !== 1 && (
              <button
                onClick={() => setZoomLevel(1)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  marginLeft: '2px',
                  transition: 'all 0.2s',
                }}
                title="Restaurar zoom al 100%"
              >
                100%
              </button>
            )}
          </div>

          {/* Time Scale Selector */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '4px',
              borderRadius: '25px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <button
              onClick={() => {
                setTimeScale('rounds');
                setHoveredStageIdx(null);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                transition: 'all 0.2s',
                background: timeScale === 'rounds' ? '#70a1ff' : 'transparent',
                color: timeScale === 'rounds' ? '#000' : '#fff',
              }}
            >
              🔄 Rondas
            </button>
            <button
              onClick={() => {
                setTimeScale('matches');
                setHoveredStageIdx(null);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                transition: 'all 0.2s',
                background: timeScale === 'matches' ? '#2ecc71' : 'transparent',
                color: timeScale === 'matches' ? '#000' : '#fff',
              }}
            >
              ⏱️ Partido a Partido
            </button>
          </div>

          {/* Mode Selector */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '4px',
              borderRadius: '25px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <button
              onClick={() => setMode('rank')}
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                transition: 'all 0.2s',
                background: mode === 'rank' ? '#00d2d3' : 'transparent',
                color: mode === 'rank' ? '#000' : '#fff',
              }}
            >
              🏆 Posición
            </button>
            <button
              onClick={() => setMode('points')}
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                transition: 'all 0.2s',
                background: mode === 'points' ? '#ff9f43' : 'transparent',
                color: mode === 'points' ? '#000' : '#fff',
              }}
            >
              📈 Puntos
            </button>
          </div>
        </div>
      </div>

      {/* LIVE TELEMETRY BAR / INSPECTOR PANEL */}
      <div
        style={{
          background: currentInspectedStage
            ? 'rgba(0, 210, 211, 0.07)'
            : 'rgba(255, 255, 255, 0.02)',
          border: '1px solid',
          borderColor: currentInspectedStage
            ? 'rgba(0, 210, 211, 0.3)'
            : 'rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '16px',
          transition: 'all 0.3s',
        }}
      >
        {currentInspectedStage ? (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '8px',
                marginBottom: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontWeight: 'bold',
                    color: '#00d2d3',
                    fontSize: '0.95rem',
                    background: 'rgba(0, 210, 211, 0.15)',
                    padding: '3px 10px',
                    borderRadius: '15px',
                    border: '1px solid rgba(0, 210, 211, 0.4)',
                  }}
                >
                  📍 {currentInspectedStage.roundName || currentInspectedStage.label}
                </span>
                {currentInspectedStage.matchTitle && (
                  <span style={{ fontSize: '0.88rem', color: '#fff', fontWeight: 'bold' }}>
                    ⚽ {currentInspectedStage.matchTitle}
                  </span>
                )}
                {currentInspectedStage.matchTime && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    🕒 {currentInspectedStage.matchTime}
                  </span>
                )}
              </div>
              <button
                onClick={() => setHoveredStageIdx(null)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  transition: 'background 0.2s',
                }}
                title="Cerrar inspección"
              >
                ✕ Cerrar detalle
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                paddingBottom: '4px',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {users
                .filter((u) => selectedUsers[u.key])
                .sort((a, b) => {
                  if (mode === 'rank')
                    return a.rankEvolution[hoveredStageIdx] - b.rankEvolution[hoveredStageIdx];
                  return b.pointsEvolution[hoveredStageIdx] - a.pointsEvolution[hoveredStageIdx];
                })
                .map((u) => {
                  const rk = u.rankEvolution[hoveredStageIdx];
                  const pts = u.pointsEvolution[hoveredStageIdx];
                  return (
                    <div
                      key={u.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: u.isMe ? 'rgba(0, 210, 211, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                        border: u.isMe ? '1px solid #00d2d3' : '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '4px 10px',
                        borderRadius: '16px',
                        fontSize: '0.8rem',
                        color: '#fff',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: u.color,
                        }}
                      ></span>
                      <span style={{ fontWeight: u.isMe ? 'bold' : 'normal' }}>{u.name}</span>
                      <span
                        style={{
                          color: mode === 'rank' ? '#00d2d3' : '#ff9f43',
                          fontWeight: 'bold',
                          marginLeft: '4px',
                        }}
                      >
                        {mode === 'rank' ? `${rk}º` : `${pts} pts`}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              padding: '4px 0',
              userSelect: 'none',
            }}
          >
            👆 <span style={{ color: '#ccc' }}>Toca cualquier columna del gráfico</span> para
            inspeccionar en directo los puntos y el ranking de ese momento (sin clics dobles).
          </div>
        )}
      </div>

      {/* SVG Interactive Chart with Touch & Widescreen Optimization */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: '8px',
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{
            width: '100%',
            minWidth:
              timeScale === 'rounds'
                ? `${Math.max(100, zoomLevel * 100)}%`
                : `${Math.max(750, zoomLevel * 750)}px`,
            height: 'auto',
            display: 'block',
            overflow: 'visible',
            transition: 'min-width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
          onClick={() => {
            setHoveredStageIdx(null);
            setHoveredUser(null);
          }}
        >
          <defs>
            <filter
              id="line-glow"
              filterUnits="userSpaceOnUse"
              x="-1000"
              y="-1000"
              width="4000"
              height="3000"
            >
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Y-Axis Grid Lines & Labels */}
          {mode === 'rank'
            ? Array.from({ length: maxRank }, (_, i) => i + 1).map((rk) => {
                const y = getY(rk, true);
                return (
                  <g key={`y-${rk}`}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="rgba(255,255,255,0.06)"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padding.left - 10}
                      y={y + 4}
                      fontSize="11"
                      textAnchor="end"
                      fontWeight={rk === 1 ? 'bold' : 'normal'}
                      fill={rk === 1 ? '#00d2d3' : 'var(--text-muted)'}
                    >
                      {rk === 1 ? '🥇 1º' : `${rk}º`}
                    </text>
                  </g>
                );
              })
            : yGridLines.map((pts) => {
                const y = getY(pts, false);
                return (
                  <g key={`y-${pts}`}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="rgba(255,255,255,0.06)"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padding.left - 10}
                      y={y + 4}
                      fill="var(--text-muted)"
                      fontSize="11"
                      textAnchor="end"
                    >
                      {pts} pts
                    </text>
                  </g>
                );
              })}

          {/* X-Axis Grid Lines & Stage Labels */}
          {activeStages.map((st, idx) => {
            const x = getX(idx);
            const isHovered = hoveredStageIdx === idx;
            const colWidth = chartW / Math.max(activeStages.length, 1);
            return (
              <g
                key={st.key}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredStageIdx(idx)}
                onClick={(e) => {
                  e.stopPropagation();
                  setHoveredStageIdx(idx);
                }}
              >
                <rect
                  x={x - colWidth / 2}
                  y={padding.top}
                  width={colWidth}
                  height={chartH}
                  fill={isHovered ? 'rgba(0, 210, 211, 0.12)' : 'transparent'}
                  style={{ transition: 'fill 0.2s' }}
                />
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={padding.top + chartH}
                  stroke={
                    isHovered
                      ? 'rgba(0, 210, 211, 0.6)'
                      : st.isRoundBoundary
                        ? 'rgba(255,255,255,0.15)'
                        : 'rgba(255,255,255,0.04)'
                  }
                  strokeWidth={isHovered ? 2 : st.isRoundBoundary ? 1.5 : 1}
                  strokeDasharray={st.isRoundBoundary && !isHovered ? '3 3' : undefined}
                />
                {(st.showLabel || isHovered) && (
                  <text
                    x={x}
                    y={height - 12}
                    fill={isHovered ? '#00d2d3' : '#aaa'}
                    fontSize={isHovered ? '12' : '11'}
                    fontWeight={isHovered ? 'bold' : 'normal'}
                    textAnchor="middle"
                  >
                    {st.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Lines for selected users */}
          {users.map((u) => {
            if (!selectedUsers[u.key]) return null;
            const isHovered = hoveredUser === u.key;
            const isOtherHovered = hoveredUser !== null && hoveredUser !== u.key;

            const points = activeStages
              .map((_, idx) => {
                let val = mode === 'rank' ? u.rankEvolution[idx] : u.pointsEvolution[idx];
                if (val === undefined || val === null || isNaN(val)) {
                  val =
                    mode === 'rank'
                      ? u.rankEvolution[idx - 1] || 1
                      : u.pointsEvolution[idx - 1] || 0;
                }
                return `${getX(idx)},${getY(val, mode === 'rank')}`;
              })
              .join(' ');

            return (
              <g
                key={u.key}
                style={{
                  opacity: isOtherHovered ? 0.15 : 1,
                  transition: 'opacity 0.2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoveredUser(u.key)}
                onMouseLeave={() => setHoveredUser(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setHoveredUser(hoveredUser === u.key ? null : u.key);
                }}
              >
                <polyline fill="none" stroke="transparent" strokeWidth="20" points={points} />
                <polyline
                  fill="none"
                  stroke={u.color}
                  strokeWidth={isHovered || u.isMe ? 3.5 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={u.isMe && !isHovered ? 'none' : undefined}
                  points={points}
                  filter={isHovered || u.isMe ? 'url(#line-glow)' : undefined}
                  style={{ transition: 'all 0.2s' }}
                />
                {activeStages.map((st, idx) => {
                  let val = mode === 'rank' ? u.rankEvolution[idx] : u.pointsEvolution[idx];
                  if (val === undefined || val === null || isNaN(val)) {
                    val =
                      mode === 'rank'
                        ? u.rankEvolution[idx - 1] || 1
                        : u.pointsEvolution[idx - 1] || 0;
                  }
                  const cx = getX(idx);
                  const cy = getY(val, mode === 'rank');
                  const isStageHovered = hoveredStageIdx === idx;
                  const shouldShowDot =
                    timeScale === 'rounds' || st.showLabel || isHovered || isStageHovered;
                  if (!shouldShowDot) return null;
                  const dotRadius = isHovered || isStageHovered ? 6 : u.isMe ? 4 : 3;
                  return (
                    <circle
                      key={idx}
                      cx={cx}
                      cy={cy}
                      r={dotRadius}
                      fill={u.color}
                      stroke="#0f0f1a"
                      strokeWidth="2"
                      style={{ transition: 'all 0.2s' }}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Participant Filter Controls */}
      <div
        style={{
          marginTop: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '14px',
          padding: '14px 4px 0 4px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '12px',
          }}
        >
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            👥 Participantes mostrados ({Object.values(selectedUsers).filter(Boolean).length}/
            {users.length}):
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => selectTopN(5)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '4px 10px',
                borderRadius: '15px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              ⚡ Top 5
            </button>
            <button
              onClick={() => selectTopN(10)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '4px 10px',
                borderRadius: '15px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              🔥 Top 10
            </button>
            <button
              onClick={selectAll}
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '4px 10px',
                borderRadius: '15px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              ✔️ Todos
            </button>
            <button
              onClick={selectNone}
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '4px 10px',
                borderRadius: '15px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              ❌ Ninguno
            </button>
          </div>
        </div>

        {/* Legend Chips Grid */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            maxHeight: '130px',
            overflowY: 'auto',
            padding: '2px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {users.map((u) => {
            const isSel = selectedUsers[u.key];
            const isHovered = hoveredUser === u.key;
            const lastIdx = activeStages.length - 1;
            return (
              <div
                key={u.key}
                onClick={() => toggleUser(u.key)}
                onMouseEnter={() => setHoveredUser(u.key)}
                onMouseLeave={() => setHoveredUser(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  transition: 'all 0.2s',
                  background: isSel
                    ? isHovered
                      ? 'rgba(255,255,255,0.2)'
                      : 'rgba(255,255,255,0.08)'
                    : 'transparent',
                  border: isSel ? `1px solid ${u.color}` : '1px solid rgba(255,255,255,0.1)',
                  color: isSel ? '#fff' : 'var(--text-muted)',
                  opacity: isSel ? 1 : 0.4,
                  boxShadow: isHovered && isSel ? `0 0 10px ${u.color}66` : 'none',
                  transform: isHovered ? 'translateY(-1px)' : 'none',
                }}
              >
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: u.color,
                    display: 'inline-block',
                  }}
                ></span>
                <span style={{ fontWeight: u.isMe ? 'bold' : 'normal' }}>
                  {u.name} {u.isMe && '★'}
                </span>
                {isSel && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: u.color,
                      fontWeight: 'bold',
                      marginLeft: '2px',
                    }}
                  >
                    {mode === 'rank'
                      ? `${u.rankEvolution[lastIdx]}º`
                      : `${u.pointsEvolution[lastIdx]}pts`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
