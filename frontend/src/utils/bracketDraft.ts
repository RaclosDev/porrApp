import { solveThirdPlaceMatrix } from './matrix';
import {
  defaultBracketState,
  type BracketMatch,
  type BracketState,
  type BracketTeam,
} from '../store/useAppStore';
import type { GroupOdds, PredictionData, TeamPair } from '../types/api';

/** Hueco de un cruce: nombre o equipo del cuadro, según de dónde venga. */
type SlotLike = string | { name?: string } | null | undefined;

export const WORLD_CUP_2026_GROUPS = {
  A: ['México', 'Sudáfrica', 'Corea del Sur', 'Chequia'],
  B: ['Canadá', 'Bosnia y Her.', 'Catar', 'Suiza'],
  C: ['Brasil', 'Marruecos', 'Haití', 'Escocia'],
  D: ['EEUU', 'Paraguay', 'Australia', 'Turquía'],
  E: ['Alemania', 'Curaçao', 'Costa de Marfil', 'Ecuador'],
  F: ['Países Bajos', 'Japón', 'Suecia', 'Túnez'],
  G: ['Bélgica', 'Egipto', 'Irán', 'Nueva Zelanda'],
  H: ['España', 'Cabo Verde', 'Arabia Saudí', 'Uruguay'],
  I: ['Francia', 'Senegal', 'Irak', 'Noruega'],
  J: ['Argentina', 'Argelia', 'Austria', 'Jordania'],
  K: ['Portugal', 'RD Congo', 'Uzbekistán', 'Colombia'],
  L: ['Inglaterra', 'Croacia', 'Ghana', 'Panamá'],
};

/** Nombre de un equipo del cuadro; los borradores antiguos guardan el nombre como texto. */
export const teamName = (team: BracketTeam | string | null | undefined): string | null =>
  (typeof team === 'string' ? team : team?.name) || null;

/** Posiciones elegidas por el usuario en un grupo ('' si el hueco está vacío). */
export interface GroupSelection {
  first: string;
  second: string;
  third: string;
}

export function hasValidGroupSelections(groups: unknown): boolean {
  if (!groups || typeof groups !== 'object') return false;
  return Object.values(groups).some((g) => {
    if (!g) return false;
    if (Array.isArray(g)) {
      return g.some(
        (team) =>
          typeof team === 'string' &&
          team.trim() !== '' &&
          !team.includes('º') &&
          team !== 'Por definir' &&
          team !== '???',
      );
    }
    if (typeof g === 'object') {
      const sel = g as Partial<GroupSelection>;
      const isReal = (t: unknown) =>
        typeof t === 'string' &&
        t.trim() !== '' &&
        !t.includes('º') &&
        t !== 'Por definir' &&
        t !== '???';
      return isReal(sel.first) || isReal(sel.second) || isReal(sel.third);
    }
    return false;
  });
}

/**
 * Reconstruye el árbol completo de bracketState a partir del DTO plano de la base de datos.
 */
export function normalizeGroupsDraft(groups: unknown): Record<string, GroupSelection> {
  if (!groups || typeof groups !== 'object') return {};
  const res: Record<string, GroupSelection> = {};
  Object.keys(groups).forEach((g) => {
    const val = (groups as Record<string, unknown>)[g];
    if (Array.isArray(val)) {
      res[g] = {
        first: val[0] || '',
        second: val[1] || '',
        third: val[2] || '',
      };
    } else if (val && typeof val === 'object') {
      const sel = val as Partial<GroupSelection>;
      res[g] = {
        first: sel.first || '',
        second: sel.second || '',
        third: sel.third || '',
      };
    }
  });
  return res;
}

export function extractGroupsFromR32(
  r32: unknown,
  groupOdds: GroupOdds | Record<string, never> = {},
): { groups: Record<string, GroupSelection>; thirds: string[] } {
  const groups: Record<string, GroupSelection> = {};
  const thirds: string[] = [];
  if (!r32) return { groups, thirds };

  // Normalize r32 into 16 match pairs: [[home, away], ...]
  let pairs: SlotLike[][] = [];
  if (r32 && typeof r32 === 'object') {
    const side = r32 as { left?: unknown; right?: unknown };
    if (Array.isArray(side.left) && Array.isArray(side.right)) {
      const left = side.left.map((m) => [m?.home?.name || m?.home, m?.away?.name || m?.away]);
      const right = side.right.map((m) => [m?.home?.name || m?.home, m?.away?.name || m?.away]);
      pairs = [...left, ...right];
    } else if (Array.isArray(r32)) {
      pairs = r32.map((m) => {
        if (Array.isArray(m)) return [m[0], m[1]];
        if (m && typeof m === 'object') return [m.home?.name || m.home, m.away?.name || m.away];
        return [null, null];
      });
    }
  }

  if (pairs.length < 16) return { groups, thirds };

  const getTeamName = (slot: SlotLike) => {
    if (!slot) return '';
    if (typeof slot === 'string') return slot.trim();
    if (typeof slot === 'object' && slot.name) return slot.name.trim();
    return '';
  };

  const setSpot = (g: string, pos: keyof GroupSelection, slot: SlotLike) => {
    const team = getTeamName(slot);
    if (!team || team.includes('º') || team === 'Por definir' || team === '???') return;
    if (!groups[g]) groups[g] = { first: '', second: '', third: '' };
    groups[g][pos] = team;
  };

  const addThird = (slot: SlotLike) => {
    const team = getTeamName(slot);
    if (!team || team.includes('º') || team === 'Por definir' || team === '???') return;
    if (!thirds.includes(team)) thirds.push(team);
  };

  // Left matches (0 to 7)
  setSpot('E', 'first', pairs[0]?.[0]);
  addThird(pairs[0]?.[1]);

  setSpot('I', 'first', pairs[1]?.[0]);
  addThird(pairs[1]?.[1]);

  setSpot('F', 'first', pairs[2]?.[0]);
  setSpot('C', 'second', pairs[2]?.[1]);

  setSpot('C', 'first', pairs[3]?.[0]);
  setSpot('F', 'second', pairs[3]?.[1]);

  setSpot('A', 'second', pairs[4]?.[0]);
  setSpot('B', 'second', pairs[4]?.[1]);

  setSpot('E', 'second', pairs[5]?.[0]);
  setSpot('I', 'second', pairs[5]?.[1]);

  setSpot('A', 'first', pairs[6]?.[0]);
  addThird(pairs[6]?.[1]);

  setSpot('L', 'first', pairs[7]?.[0]);
  addThird(pairs[7]?.[1]);

  // Right matches (8 to 15)
  setSpot('K', 'second', pairs[8]?.[0]);
  setSpot('L', 'second', pairs[8]?.[1]);

  setSpot('H', 'first', pairs[9]?.[0]);
  setSpot('J', 'second', pairs[9]?.[1]);

  setSpot('D', 'first', pairs[10]?.[0]);
  addThird(pairs[10]?.[1]);

  setSpot('G', 'first', pairs[11]?.[0]);
  addThird(pairs[11]?.[1]);

  setSpot('J', 'first', pairs[12]?.[0]);
  setSpot('H', 'second', pairs[12]?.[1]);

  setSpot('D', 'second', pairs[13]?.[0]);
  setSpot('G', 'second', pairs[13]?.[1]);

  setSpot('B', 'first', pairs[14]?.[0]);
  addThird(pairs[14]?.[1]);

  setSpot('K', 'first', pairs[15]?.[0]);
  addThird(pairs[15]?.[1]);

  const findGroupByTeamName = (teamName: string) => {
    if (!teamName) return null;
    const lower = teamName.toLowerCase().trim();
    if (groupOdds && typeof groupOdds === 'object') {
      for (const [g, teamList] of Object.entries(groupOdds)) {
        if (
          Array.isArray(teamList) &&
          teamList.some((t) => (t?.name || '').toLowerCase().trim() === lower)
        ) {
          return g;
        }
      }
    }
    for (const [g, teamList] of Object.entries(WORLD_CUP_2026_GROUPS)) {
      if (teamList.some((t) => t.toLowerCase().trim() === lower)) {
        return g;
      }
    }
    return null;
  };

  thirds.forEach((thirdTeam) => {
    const g = findGroupByTeamName(thirdTeam);
    if (g) {
      if (!groups[g]) groups[g] = { first: '', second: '', third: '' };
      groups[g].third = thirdTeam;
    }
  });

  return { groups, thirds };
}

export function buildR32FromGroups(
  groupsInput: unknown,
  thirdsRaw: (string | { team?: string; name?: string })[] = [],
): string[][] | null {
  if (!groupsInput || typeof groupsInput !== 'object') return null;
  const groups = normalizeGroupsDraft(groupsInput);
  if (!hasValidGroupSelections(groups)) return null;

  // Resolve third-place teams
  let advancingThirds: string[] = [];
  if (Array.isArray(thirdsRaw) && thirdsRaw.length > 0) {
    advancingThirds = thirdsRaw
      .map((t) => (typeof t === 'string' ? t.trim() : t?.team || t?.name || ''))
      .filter((t) => t && !t.includes('º') && t !== 'Por definir' && t !== '???');
  }
  if (advancingThirds.length < 8) {
    Object.keys(groups).forEach((g) => {
      const th = groups[g]?.third;
      if (
        th &&
        !th.includes('º') &&
        th !== 'Por definir' &&
        th !== '???' &&
        !advancingThirds.includes(th)
      ) {
        advancingThirds.push(th);
      }
    });
  }

  const teamToGroup: Record<string, string> = {};
  Object.keys(groups).forEach((g) => {
    if (groups[g]?.third) teamToGroup[groups[g].third] = g;
    if (groups[g]?.first) teamToGroup[groups[g].first] = g;
    if (groups[g]?.second) teamToGroup[groups[g].second] = g;
  });

  const findGroupByTeam = (teamName: string) => {
    if (!teamName) return null;
    if (teamToGroup[teamName]) return teamToGroup[teamName];
    const lower = teamName.toLowerCase().trim();
    for (const [g, teamList] of Object.entries(WORLD_CUP_2026_GROUPS)) {
      if (teamList.some((t) => t.toLowerCase().trim() === lower)) {
        return g;
      }
    }
    return null;
  };

  const thirdObjects = advancingThirds.slice(0, 8).map((t) => ({
    team: t,
    group: findGroupByTeam(t) || 'A',
  }));

  const solvedMatrix = solveThirdPlaceMatrix(thirdObjects);
  const thirdSlotTeams = Array(8).fill(null);
  if (solvedMatrix) {
    solvedMatrix.forEach((m, idx) => {
      thirdSlotTeams[idx] = m?.team || null;
    });
  } else {
    advancingThirds.slice(0, 8).forEach((t, idx) => {
      thirdSlotTeams[idx] = t;
    });
  }

  const gFirst = (g: string) => groups[g]?.first || `1º Grupo ${g}`;
  const gSecond = (g: string) => groups[g]?.second || `2º Grupo ${g}`;
  const gThird = (idx: number, placeholder: string) => thirdSlotTeams[idx] || placeholder;

  return [
    [gFirst('E'), gThird(0, '3º A/B/C/D/F')],
    [gFirst('I'), gThird(1, '3º C/D/F/G/H')],
    [gFirst('F'), gSecond('C')],
    [gFirst('C'), gSecond('F')],
    [gSecond('A'), gSecond('B')],
    [gSecond('E'), gSecond('I')],
    [gFirst('A'), gThird(2, '3º C/E/F/H/I')],
    [gFirst('L'), gThird(3, '3º E/H/I/J/K')],
    [gSecond('K'), gSecond('L')],
    [gFirst('H'), gSecond('J')],
    [gFirst('D'), gThird(4, '3º B/E/F/I/J')],
    [gFirst('G'), gThird(5, '3º A/E/H/I/J')],
    [gFirst('J'), gSecond('H')],
    [gSecond('D'), gSecond('G')],
    [gFirst('B'), gThird(6, '3º E/F/G/I/J')],
    [gFirst('K'), gThird(7, '3º D/E/I/J/L')],
  ];
}

/** Pronóstico tal como llega del backend; los grupos pueden venir como listas o posiciones. */
type StoredPrediction = Omit<PredictionData, 'groups'> & {
  groups?: Record<string, string[] | GroupSelection>;
};

export function reconstructBracketState(
  data: StoredPrediction | null | undefined,
): BracketState | null {
  if (!data) return null;
  const toSlot = (name: string | null | undefined) =>
    name && typeof name === 'string' && name.trim() && name !== 'Por definir' && name !== '???'
      ? { name: name.trim() }
      : null;

  const toMatches = (
    pairs: TeamPair[] | null,
    start: number,
    count: number,
    prefix: string,
  ): BracketMatch[] => {
    const slice = (pairs || []).slice(start, start + count);
    const result: BracketMatch[] = [];
    for (let i = 0; i < count; i++) {
      const p = slice[i];
      result.push({
        home: toSlot(p?.[0]),
        away: toSlot(p?.[1]),
        id: `${prefix}_${i}`,
      });
    }
    return result;
  };

  const pairToMatch = (pair: string[] | undefined, id: string): BracketMatch | null =>
    pair && (pair[0] || pair[1]) ? { home: toSlot(pair[0]), away: toSlot(pair[1]), id } : null;

  let r32Data: TeamPair[] | null = null;
  if (Array.isArray(data.r32) && data.r32.length >= 16) {
    r32Data = data.r32;
  } else if (Array.isArray(data.r1) && data.r1.length >= 16) {
    r32Data = data.r1;
  } else if (data.groups && hasValidGroupSelections(normalizeGroupsDraft(data.groups))) {
    r32Data = buildR32FromGroups(data.groups, data.thirds);
  }

  const hasR32 = Boolean(r32Data && r32Data.length >= 16);

  return {
    r32: hasR32
      ? {
          left: toMatches(r32Data, 0, 8, 'L'),
          right: toMatches(r32Data, 8, 8, 'R'),
        }
      : defaultBracketState.r32,
    r16: {
      left: toMatches(data.r16 || [], 0, 4, 'L8'),
      right: toMatches(data.r16 || [], 4, 4, 'R8'),
    },
    qf: {
      left: toMatches(data.qf || [], 0, 2, 'L4'),
      right: toMatches(data.qf || [], 2, 2, 'R4'),
    },
    sf: {
      left: toMatches(data.sf || [], 0, 1, 'L2'),
      right: toMatches(data.sf || [], 1, 1, 'R2'),
    },
    final: pairToMatch(data.final, 'FINAL'),
    champion: toSlot(data.champion),
    thirdPlaceMatch: pairToMatch(data.thirdPlaceMatch, 'THIRD'),
    thirdPlaceWinner: toSlot(data.thirdPlaceWinner),
  };
}
