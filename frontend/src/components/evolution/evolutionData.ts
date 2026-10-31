import type { LeaderboardRow } from '../../hooks/useLeaderboard';
import type { Match } from '../../types/api';

/** Punto del eje X: una ronda o un partido de eliminatoria. */
export interface ChartStage {
  key: string;
  label: string;
  roundName: string;
  showLabel: boolean;
  isRoundBoundary: boolean;
  matchTitle?: string | null;
  matchTime?: string | null;
  /** Campo de ParticipantScore con los puntos de la ronda. */
  prop?: StagePointsKey;
  home?: string;
  away?: string;
  /** Índice del partido de eliminatoria (0-31). */
  mIdx?: number;
}

/** Serie de un participante en el gráfico. */
export interface ChartUser {
  key: number | string;
  name: string;
  isMe: boolean;
  color: string;
  pointsEvolution: number[];
  rankEvolution: number[];
  totalPoints: number;
}

export interface EvolutionChartProps {
  validResults: LeaderboardRow[];
  userName: string;
  allGames: Match[];
}

/** Campos de ParticipantScore con los puntos de cada ronda. */
type StagePointsKey = 'r1' | 'r32' | 'r16' | 'qf' | 'sf' | 'finals' | 'scorer';

const STAGES: { key: string; label: string; prop: StagePointsKey }[] = [
  { key: 'r1', label: 'F.Grupos', prop: 'r1' },
  { key: 'r32', label: 'Dieciseisavos', prop: 'r32' },
  { key: 'r16', label: 'Octavos', prop: 'r16' },
  { key: 'qf', label: 'Cuartos', prop: 'qf' },
  { key: 'sf', label: 'Semis', prop: 'sf' },
  { key: 'finals', label: 'Finales', prop: 'finals' },
  { key: 'total', label: 'Total', prop: 'scorer' },
];

export const PALETTE = [
  '#0b5f74',
  '#92400e',
  '#b91c1c',
  '#166534',
  '#1d4ed8',
  '#7e22ce',
  '#854d0e',
  '#9a3412',
  '#9f1239',
  '#115e59',
  '#075985',
  '#6b21a8',
  '#9d174d',
  '#3f6212',
  '#1e40af',
  '#4338ca',
  '#713f12',
  '#991b1b',
];

export type TimeScale = 'rounds' | 'matches';

/** Participantes visibles en el gráfico, por clave de fila. */
export type Selection = Record<string, boolean>;

/** Último partido de cada ronda de eliminatorias -> rondas ya cerradas tras él. */
const ROUNDS_CLOSED_AFTER_MATCH: Record<number, StagePointsKey[]> = {
  15: ['r1', 'r32'],
  23: ['r1', 'r32', 'r16'],
  27: ['r1', 'r32', 'r16', 'qf'],
  29: ['r1', 'r32', 'r16', 'qf', 'sf'],
  31: ['r1', 'r32', 'r16', 'qf', 'sf', 'finals'],
};

export interface EvolutionData {
  users: ChartUser[];
  yMin: number;
  yMax: number;
  yGridLines: number[];
  maxRank: number;
}

/**
 * Puntos del eje X: por rondas o partido a partido. Nunca incluye un punto
 * inicial vacío y termina en la última ronda o partido ya disputado.
 */
export function buildStages(
  timeScale: TimeScale,
  validResults: LeaderboardRow[],
  allGames: Match[],
): ChartStage[] {
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

    // El eje termina en el último dato disputado.
    const limitIdx = Math.min(Math.max(lastPlayedIdx + 1, 1), allRounds.length);
    return allRounds.slice(0, limitIdx);
  }

  // Partido a partido: empieza en Grupos, sin punto inicial.
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

  // Último partido de eliminatoria jugado, sin mirar las fechas.
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

  // El punto Total solo aparece con los 32 partidos de eliminatoria jugados.
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
}

/**
 * Puntos acumulados y posición de cada participante en cada punto del eje,
 * con la escala Y ajustada a los participantes seleccionados.
 */
export function buildEvolution(
  validResults: LeaderboardRow[],
  userName: string,
  timeScale: TimeScale,
  activeStages: ChartStage[],
  selectedUsers: Record<string, boolean>,
): EvolutionData {
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
      const ptsList: number[] = [];
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
        const mIdx = st.mIdx ?? 0;
        let stageType = 'r32';
        if (mIdx >= 30) stageType = 'finals';
        else if (mIdx >= 28) stageType = 'sf';
        else if (mIdx >= 24) stageType = 'qf';
        else if (mIdx >= 16) stageType = 'r16';

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

        // Al cerrar cada ronda, se cuadra con el total oficial de las rondas jugadas.
        const closedRounds = ROUNDS_CLOSED_AFTER_MATCH[mIdx];
        if (closedRounds) {
          currentKoCum = closedRounds.reduce((sum, key) => sum + (Number(r.points[key]) || 0), 0);
        }

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
    let prevPts: number | null = null;
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

  // Escala Y solo con los participantes seleccionados.
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
  let step: number;
  if (rawRange <= 20) step = 5;
  else if (rawRange <= 50) step = 10;
  else if (rawRange <= 120) step = 25;
  else if (rawRange <= 250) step = 50;
  else if (rawRange <= 600) step = 100;
  else step = 200;

  const yMin = Math.floor(minPts / step) * step;
  let yMax = Math.ceil(maxPts / step) * step;
  if (yMax <= yMin) yMax = yMin + step;

  const yGridLines: number[] = [];
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
}
