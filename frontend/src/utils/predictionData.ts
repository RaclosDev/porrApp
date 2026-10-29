import type { GroupOdds, GroupStandings, Match, PredictionData, TeamPair } from '../types/api';
import {
  buildR32FromGroups,
  extractGroupsFromR32,
  hasValidGroupSelections,
  type GroupSelection,
} from '../hooks/useBracket';

/** Pronóstico listo para el visor: grupos como posiciones y cruces con nombres. */
export type ViewerPrediction = Omit<PredictionData, 'groups'> & {
  groups?: Record<string, GroupSelection | string[]>;
};

/** El torneo ya está en eliminatorias (hay partidos o cruces oficiales con equipos reales). */
export const checkIsKnockoutPhase = (
  games: Match[] | null | undefined,
  officialData: PredictionData | null | undefined,
): boolean => {
  if (games && games.length > 0) {
    const hasActiveKo = games.some((g) => {
      if (!g || g.round === 'group' || g.round === 'r1' || g.round === '1') return false;
      if (g.finished || g.home_score != null || g.away_score != null) return true;
      if (
        g.home &&
        typeof g.home === 'string' &&
        g.home !== 'Por definir' &&
        g.home !== 'TBD' &&
        !g.home.includes('º')
      )
        return true;
      if (g.date && new Date(g.date) <= new Date()) return true;
      return false;
    });
    if (hasActiveKo) return true;
  }
  if (officialData) {
    const allKo = [
      ...(officialData.r32 || []),
      ...(officialData.r16 || []),
      ...(officialData.qf || []),
      ...(officialData.sf || []),
      officialData.final || [],
      officialData.thirdPlaceMatch || [],
    ].flat(2);
    if (
      allKo.some(
        (team) =>
          team &&
          typeof team === 'string' &&
          team !== 'Por definir' &&
          team !== '???' &&
          !team.includes('º'),
      )
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Sustituye en los dieciseisavos oficiales los huecos "1º/2º Grupo X" por los equipos
 * que ya tienen la plaza asegurada según la clasificación.
 */
export const injectQualifiedTeams = (
  partData: PredictionData | null,
  ptsData: GroupStandings | null | undefined,
): PredictionData | null => {
  if (!partData?.r32 || !ptsData) return partData;
  const guaranteed: Record<string, Record<string, string>> = {};
  Object.keys(ptsData).forEach((group) => {
    guaranteed[group] = {};
    const status5Teams: string[] = [];
    Object.keys(ptsData[group]).forEach((team) => {
      const st = ptsData[group][team].status;
      if (st === 1) guaranteed[group]['1'] = team;
      else if (st === 2) guaranteed[group]['2'] = team;
      else if (st === 5) status5Teams.push(team);
    });

    if (status5Teams.length > 0) {
      const combinedName = status5Teams.join(' / ');
      if (!guaranteed[group]['1']) guaranteed[group]['1'] = combinedName;
      if (!guaranteed[group]['2']) guaranteed[group]['2'] = combinedName;
    }
  });
  const newPart = JSON.parse(JSON.stringify(partData));
  newPart.r32 = newPart.r32.map((match: TeamPair) =>
    match.map((teamName) => {
      if (typeof teamName === 'string' && teamName.includes('º Grupo ')) {
        const parts = teamName.split(' ');
        const grp = parts[2];
        if (guaranteed[grp]?.[parts[0].replace('º', '')])
          return guaranteed[grp][parts[0].replace('º', '')];
      }
      return teamName;
    }),
  );
  return newPart;
};
/**
 * Completa un pronóstico para el visor sin mutar el original (puede venir de la caché de
 * React Query): rellena la final y el tercer puesto que falten a partir de semifinales y
 * campeón, y deriva los grupos o los dieciseisavos cuando solo se guardó uno de los dos.
 */
export const normalizePart = (
  partData: PredictionData | null,
  odds: GroupOdds | undefined,
): ViewerPrediction | null => {
  if (!partData) return null;
  const normalized: ViewerPrediction = JSON.parse(JSON.stringify(partData));
  const sf = normalized.sf;

  // Final vacía pero con semifinales y campeón.
  if (
    (!normalized.final?.[0] || !normalized.final?.[1]) &&
    sf &&
    sf.length >= 2 &&
    normalized.champion
  ) {
    const sf1 = sf[0] || [];
    const sf2 = sf[1] || [];
    const champ = normalized.champion;
    const thirds = normalized.thirdPlaceMatch || [];
    const inSf1 = sf1.includes(champ);
    const inSf2 = sf2.includes(champ);
    let finalist1 = inSf1 ? champ : null;
    let finalist2 = inSf2 ? champ : null;
    if (inSf1) finalist2 = sf2.find((t) => t && !thirds.includes(t)) || sf2[0] || null;
    else if (inSf2) finalist1 = sf1.find((t) => t && !thirds.includes(t)) || sf1[0] || null;
    if (finalist1 && finalist2) normalized.final = [finalist1, finalist2];
  }

  // Tercer puesto vacío pero con semifinales y final: son los dos semifinalistas eliminados.
  const final = normalized.final;
  if (
    (!normalized.thirdPlaceMatch?.[0] || !normalized.thirdPlaceMatch?.[1]) &&
    sf &&
    sf.length >= 2 &&
    final?.[0] &&
    final?.[1]
  ) {
    const t1 = (sf[0] || []).find((t) => t && !final.includes(t));
    const t2 = (sf[1] || []).find((t) => t && !final.includes(t));
    if (t1 && t2) normalized.thirdPlaceMatch = [t1, t2];
  }

  if (!hasValidGroupSelections(normalized.groups) && (normalized.r32 || normalized.r1)) {
    const extracted = extractGroupsFromR32(normalized.r32 || normalized.r1, odds);
    if (hasValidGroupSelections(extracted.groups)) {
      normalized.groups = extracted.groups;
      if (!normalized.thirds || normalized.thirds.length === 0) {
        normalized.thirds = extracted.thirds;
      }
    }
  }

  if (!Array.isArray(normalized.r32) || normalized.r32.length < 16) {
    if (Array.isArray(normalized.r1) && normalized.r1.length >= 16) {
      normalized.r32 = normalized.r1;
    } else if (normalized.groups && hasValidGroupSelections(normalized.groups)) {
      normalized.r32 = buildR32FromGroups(normalized.groups, normalized.thirds) ?? undefined;
    }
  }

  return normalized;
};
