import { solveThirdPlaceMatrix } from './matrix';
import {
  getDefaultBracketState,
  type BracketMatch,
  type BracketState,
  type BracketTeam,
} from '../store/useAppStore';
import type { GroupOdds, PredictionData, TeamPair, TournamentFormat } from '../types/api';
import { orderR32, legacyR32Order, topologyVersion, type TopologyVersion } from './bracketTopology';
import { thirdPlaceRules } from './matrix';
import {
  BRACKET_ROUNDS,
  WORLD_CUP_2026_FORMAT,
  firstRoundInLegacyOrder,
  groupSpot,
  isThirdSlot,
  slotLabel,
  type GroupSlot,
} from './firstKnockoutRound';

/** Hueco de un cruce: nombre o equipo del cuadro, según de dónde venga. */
type SlotLike = string | { name?: string } | null | undefined;

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

/**
 * Primera ronda guardada de un pronóstico: los cruces de la ronda en la que empieza su torneo. Los
 * dieciseisavos del Mundial se guardaron antes como `r1`.
 */
export const storedFirstRound = (
  data: Pick<PredictionData, 'r1' | 'r32' | 'r16' | 'qf' | 'sf'>,
  format: TournamentFormat = WORLD_CUP_2026_FORMAT,
): TeamPair[] | undefined => {
  if (format.firstRound !== 'r32') return data[format.firstRound] ?? undefined;
  return data.r32?.length ? data.r32 : (data.r1 ?? data.r32 ?? undefined);
};

/** Deduce los puestos de grupo de la primera ronda de un cuadro (la del torneo de `format`). */
export function extractGroupsFromR32(
  r32: unknown,
  groupOdds: GroupOdds | Record<string, never> = {},
  version?: TopologyVersion,
  format: TournamentFormat = WORLD_CUP_2026_FORMAT,
): { groups: Record<string, GroupSelection>; thirds: string[] } {
  const groups: Record<string, GroupSelection> = {};
  const thirds: string[] = [];
  if (!r32) return { groups, thirds };

  // Normaliza la ronda a pares [[local, visitante], ...]
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

  if (pairs.length < format.firstKnockoutRound.length) return { groups, thirds };
  pairs = legacyR32Order(pairs, version);

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

  firstRoundInLegacyOrder(format.firstKnockoutRound).forEach((slots, index) => {
    slots.forEach((slot, side) => {
      const team = pairs[index]?.[side];
      if (isThirdSlot(slot)) {
        addThird(team);
      } else {
        const { group, position } = groupSpot(slot);
        setSpot(group, position, team);
      }
    });
  });

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
  version?: TopologyVersion,
  format: TournamentFormat = WORLD_CUP_2026_FORMAT,
): string[][] | null {
  const bestThirds = format.bestThirds;
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
  if (advancingThirds.length < bestThirds) {
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

  const thirdObjects = advancingThirds.slice(0, bestThirds).map((t) => ({
    team: t,
    group: teamToGroup[t] || 'A',
  }));

  const solvedMatrix = solveThirdPlaceMatrix(
    thirdObjects,
    thirdPlaceRules(format.firstKnockoutRound),
  );
  const thirdSlotTeams = Array(bestThirds).fill(null);
  if (solvedMatrix) {
    solvedMatrix.forEach((m, idx) => {
      thirdSlotTeams[idx] = m?.team || null;
    });
  } else {
    advancingThirds.slice(0, bestThirds).forEach((t, idx) => {
      thirdSlotTeams[idx] = t;
    });
  }

  // Los terceros ya vienen repartidos en el orden de sus huecos.
  let thirdSlot = 0;
  const teamOf = (slot: GroupSlot) => {
    if (isThirdSlot(slot)) return thirdSlotTeams[thirdSlot++] || slotLabel(slot);
    const { group, position } = groupSpot(slot);
    return groups[group]?.[position] || slotLabel(slot);
  };

  return orderR32(
    firstRoundInLegacyOrder(format.firstKnockoutRound).map(([home, away]) => [
      teamOf(home),
      teamOf(away),
    ]),
    version,
  );
}

/** Pronóstico tal como llega del backend; los grupos pueden venir como listas o posiciones. */
type StoredPrediction = Omit<PredictionData, 'groups'> & {
  groups?: Record<string, string[] | GroupSelection>;
};

/** Cruces por lado de cada ronda de un cuadro completo, y el prefijo de sus identificadores. */
const SIDE_SIZES = [8, 4, 2, 1];
const ID_PREFIXES = ['', '8', '4', '2'];

/** Reconstruye el cuadro del editor a partir del pronóstico guardado de un torneo. */
export function reconstructBracketState(
  data: StoredPrediction | null | undefined,
  format: TournamentFormat = WORLD_CUP_2026_FORMAT,
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

  const size = format.firstKnockoutRound.length;
  const start = Math.max(0, BRACKET_ROUNDS.indexOf(format.firstRound));
  const stored = storedFirstRound(data, format);
  let firstRound: TeamPair[] | null = null;
  if (Array.isArray(stored) && stored.length >= size) {
    firstRound = stored;
  } else if (data.groups && hasValidGroupSelections(normalizeGroupsDraft(data.groups))) {
    firstRound = buildR32FromGroups(data.groups, data.thirds, data.topologyVersion, format);
  }
  const hasFirstRound = Boolean(firstRound && firstRound.length >= size);
  const empty = getDefaultBracketState(data.topologyVersion, format);

  const round = (index: number) => {
    const key = BRACKET_ROUNDS[index];
    if (index < start) return { left: [], right: [] };
    if (index === start && !hasFirstRound) return empty[key];
    const pairs = index === start ? firstRound : data[key] || [];
    const perSide = index === start ? size / 2 : SIDE_SIZES[index];
    return {
      left: toMatches(pairs, 0, perSide, `L${ID_PREFIXES[index]}`),
      right: toMatches(pairs, perSide, perSide, `R${ID_PREFIXES[index]}`),
    };
  };

  return {
    topologyVersion: topologyVersion(data.topologyVersion),
    r32: round(0),
    r16: round(1),
    qf: round(2),
    sf: round(3),
    final: pairToMatch(data.final, 'FINAL'),
    champion: toSlot(data.champion),
    thirdPlaceMatch: pairToMatch(data.thirdPlaceMatch, 'THIRD'),
    thirdPlaceWinner: toSlot(data.thirdPlaceWinner),
  };
}
