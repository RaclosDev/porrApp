/** Operaciones puras del editor del cuadro del Mundial (useBracket). */
import { teamKey } from './teamKey';
import { solveThirdPlaceMatrix, THIRD_PLACE_RULES } from './matrix';
import { r32SlotIndex, topologyVersion } from './bracketTopology';
import { teamName, type GroupSelection } from './bracketDraft';
import {
  defaultBracketState,
  getDefaultBracketState,
  type BracketMatch,
  type BracketState,
  type BracketTeam,
} from '../store/useAppStore';
import type { GroupOdds, GroupStandings, PredictionData, TeamPair } from '../types/api';

const cloneBracket = (state: BracketState): BracketState => JSON.parse(JSON.stringify(state));

/** El cuadro no tiene nada rellenado (no hay borrador local que conservar). */
export const isEmptyBracket = (state: BracketState): boolean =>
  state === defaultBracketState ||
  JSON.stringify({ ...state, topologyVersion: undefined }) ===
    JSON.stringify({
      ...getDefaultBracketState(state.topologyVersion),
      topologyVersion: undefined,
    });

/** Nombres de los dos equipos de un cruce, si ya están los dos. */
const matchPair = (m: BracketMatch | null): string[] | undefined => {
  const home = m?.home?.name;
  const away = m?.away?.name;
  return home && away ? [home, away] : undefined;
};

/** Cruces de una ronda con los huecos («1º Grupo A»…) como null. */
const teamPairs = (matches: BracketMatch[]): TeamPair[] =>
  matches.map((m): TeamPair => [
    m.home?.name && !m.home.name.includes('º') ? m.home.name : null,
    m.away?.name && !m.away.name.includes('º') ? m.away.name : null,
  ]);

const r32Slots = (state: BracketState) => [...state.r32.left, ...state.r32.right];

/** Algún hueco de dieciseisavos sigue sin equipo real. */
export function hasPlaceholderSlots(state: BracketState): boolean {
  const matches = [...(state.r32?.left || []), ...(state.r32?.right || [])];
  if (matches.length === 0) return true;
  return matches.some(
    (m) =>
      !m.home?.name ||
      m.home.name.includes('º') ||
      m.home.name.startsWith('3º') ||
      !m.away?.name ||
      m.away.name.includes('º') ||
      m.away.name.startsWith('3º'),
  );
}

/** Algún hueco de dieciseisavos tiene ya un equipo real. */
export function hasAnyRealTeam(state: BracketState): boolean {
  const real = (name: string | undefined) =>
    Boolean(name && !name.includes('º') && name !== 'Por definir' && name !== '???');
  return [...(state.r32?.left || []), ...(state.r32?.right || [])].some(
    (m) => real(m.home?.name) || real(m.away?.name),
  );
}

/**
 * En «solo eliminatorias», pone en los huecos «1º/2º Grupo X» los equipos que ya son primeros o
 * segundos matemáticamente. Devuelve el cuadro nuevo, o null si no cambia nada.
 */
export function fillKnownQualifiers(
  state: BracketState,
  officialPoints: GroupStandings,
  groupOdds: GroupOdds | null | undefined,
): BracketState | null {
  if (!officialPoints || Object.keys(officialPoints).length === 0) return null;
  const hasAnyPlaceholder = r32Slots(state).some(
    (m) => m.home?.name?.includes('º') || m.away?.name?.includes('º'),
  );
  if (!hasAnyPlaceholder) return null;

  const firstPlace: Record<string, string> = {};
  const secondPlace: Record<string, string> = {};
  Object.entries(officialPoints).forEach(([g, teams]) => {
    Object.entries(teams).forEach(([name, s]) => {
      if (s.status === 1) firstPlace[g] = name;
      if (s.status === 2) secondPlace[g] = name;
    });
  });
  // La clasificación usa la clave saneada; el cuadro, el nombre real.
  for (const places of [firstPlace, secondPlace]) {
    Object.keys(places).forEach((g) => {
      const original = (groupOdds?.[g] || []).find((t) => teamKey(t.name) === places[g]);
      if (original) places[g] = original.name;
    });
  }
  if (!Object.keys(firstPlace).length && !Object.keys(secondPlace).length) return null;

  const next = cloneBracket(state);
  let changed = false;
  const updateSlot = (slot: BracketTeam | null) => {
    if (slot?.name?.startsWith('1º Grupo ')) {
      const g = slot.name.replace('1º Grupo ', '');
      if (firstPlace[g]) {
        slot.name = firstPlace[g];
        changed = true;
      }
    } else if (slot?.name?.startsWith('2º Grupo ')) {
      const g = slot.name.replace('2º Grupo ', '');
      if (secondPlace[g]) {
        slot.name = secondPlace[g];
        changed = true;
      }
    }
  };
  r32Slots(next).forEach((m) => {
    updateSlot(m.home);
    updateSlot(m.away);
  });
  return changed ? next : null;
}

/** Coloca en dieciseisavos a los clasificados de cada grupo y a los mejores terceros. */
export function applyGroupStage(
  state: BracketState,
  selections: Record<string, GroupSelection>,
  advancingThirds: string[],
): BracketState {
  const next = cloneBracket(state);
  const applySlot = (slot: BracketTeam | null) => {
    if (!slot?.name?.includes('º Grupo')) return;
    const [pos, , group] = slot.name.split(' ');
    const sel = selections[group];
    if (sel) slot.name = pos === '1º' ? sel.first : sel.second;
  };
  r32Slots(next).forEach((m) => {
    applySlot(m.home);
    applySlot(m.away);
  });

  const teamToGroup: Record<string, string> = {};
  Object.keys(selections).forEach((g) => {
    if (selections[g].third) teamToGroup[selections[g].third] = g;
  });

  const solvedMatrix = solveThirdPlaceMatrix(
    advancingThirds.map((t) => ({ team: t, group: teamToGroup[t] })),
  );
  if (solvedMatrix) {
    THIRD_PLACE_RULES.forEach((rule, idx) => {
      const index = r32SlotIndex(
        (rule.side === 'right' ? 8 : 0) + rule.matchIndex,
        next.topologyVersion,
      );
      const match = next.r32[index < 8 ? 'left' : 'right'][index % 8];
      const slot = rule.isHome ? match.home : match.away;
      if (slot?.name?.startsWith('3º ')) slot.name = solvedMatrix[idx].team;
    });
  } else {
    const sortedThirds = [...advancingThirds].sort((a, b) =>
      teamToGroup[a].localeCompare(teamToGroup[b]),
    );
    let ti = 0;
    const applyThirdFallback = (slot: BracketTeam | null) => {
      if (slot?.name?.startsWith('3º ') && ti < sortedThirds.length) slot.name = sortedThirds[ti++];
    };
    r32Slots(next).forEach((m) => {
      applyThirdFallback(m.home);
      applyThirdFallback(m.away);
    });
  }
  return next;
}

/** Algún cruce de dieciseisavos sigue con un hueco sin rellenar («1º Grupo A»…). */
export const hasIncompleteR32 = (state: BracketState) =>
  r32Slots(state).some(
    (m) => !m.home?.name || m.home.name.includes('º') || !m.away?.name || m.away.name.includes('º'),
  );

interface PredictionInput {
  state: BracketState;
  userName: string;
  predictionName: string;
  topScorer: string;
  groups: Record<string, GroupSelection>;
  thirds: string[];
  knockoutsOnly: boolean;
}

/** El pronóstico tal como lo guarda el servidor. */
export function buildBracketPrediction({
  state,
  userName,
  predictionName,
  topScorer,
  groups,
  thirds,
  knockoutsOnly,
}: PredictionInput): PredictionData {
  const pairs = (round: 'r32' | 'r16' | 'qf' | 'sf') => [
    ...teamPairs(state[round].left),
    ...teamPairs(state[round].right),
  ];
  const r32 = pairs('r32');
  const formattedGroups: Record<string, string[]> = {};
  Object.keys(groups).forEach((g) => {
    formattedGroups[g] = [groups[g].first, groups[g].second];
    if (groups[g].third) formattedGroups[g].push(groups[g].third);
  });
  return {
    topologyVersion: topologyVersion(state.topologyVersion),
    user: userName,
    prediction: predictionName,
    r1: r32,
    r32,
    r16: pairs('r16'),
    qf: pairs('qf'),
    sf: pairs('sf'),
    final: matchPair(state.final),
    champion: teamName(state.champion),
    thirdPlaceMatch: matchPair(state.thirdPlaceMatch),
    thirdPlaceWinner: teamName(state.thirdPlaceWinner),
    scorer: topScorer,
    groups: knockoutsOnly ? {} : formattedGroups,
    thirds: knockoutsOnly ? [] : thirds,
  };
}

/** Estado matemático del equipo en su grupo (0: aún no se sabe). */
export function officialGroupStatus(
  team: string | null | undefined,
  officialPoints: GroupStandings | null | undefined,
  groupOdds: GroupOdds | null | undefined,
): number {
  if (!team || !officialPoints || !groupOdds) return 0;
  for (const groupName of Object.keys(officialPoints)) {
    if (!groupOdds[groupName]?.some((t) => t.name === team)) continue;
    const officialData = officialPoints[groupName][teamKey(team)];
    if (typeof officialData === 'object' && officialData !== null) return officialData.status || 0;
  }
  return 0;
}
