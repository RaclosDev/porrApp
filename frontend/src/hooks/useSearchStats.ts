import { useMemo } from 'react';
import { countryCodeMap } from '../utils/constants';
import type { GroupOdds, PredictionSummary, TeamPair } from '../types/api';

/** Participante que cumple (o no) la condición buscada. */
export interface SearchMatch {
  name: string;
  /** Clave del pronóstico, para abrirlo en el visor. */
  id: string;
}

const topTeams = [
  'Brasil',
  'Francia',
  'Argentina',
  'España',
  'Inglaterra',
  'Alemania',
  'Portugal',
  'Bélgica',
  'Países Bajos',
];

export function useSearchStats(
  participantsHashes: PredictionSummary[],
  groupOdds: GroupOdds,
  userName: string,
  selectedTeam: string,
  selectedCondition: string,
  selectedUser: string,
) {
  const allTeams = useMemo(() => {
    const teams: string[] = [];
    if (groupOdds) {
      Object.keys(groupOdds).forEach((g) => {
        groupOdds[g].forEach((t) => teams.push(t.name));
      });
    }
    return teams.sort((a, b) => a.localeCompare(b));
  }, [groupOdds]);

  const allUsers = useMemo(() => {
    const users: string[] = participantsHashes.map((p) => {
      const part = p.data;
      return part ? part.user || p.participantName || 'Anónimo' : 'Anónimo';
    });
    return [...new Set(users)].sort((a, b) => a.localeCompare(b));
  }, [participantsHashes]);

  const { teamResults, teamNegativeResults } = useMemo(() => {
    if (!selectedTeam) return { teamResults: null, teamNegativeResults: null };

    const lowerTeam = selectedTeam.toLowerCase();
    const matches: SearchMatch[] = [];
    const nonMatches: SearchMatch[] = [];

    participantsHashes.forEach((p) => {
      const part = p.data;
      if (!part) return;
      const uName = part.user || p.participantName || 'Anónimo';
      let match = false;
      const cond = selectedCondition;

      if (cond === 'first_group' && part.groups) {
        match = Object.values(part.groups as Record<string, string[]>).some(
          (g) => g[0].toLowerCase() === lowerTeam,
        );
      } else if (cond === 'second_group' && part.groups) {
        match = Object.values(part.groups as Record<string, string[]>).some(
          (g) => g[1].toLowerCase() === lowerTeam,
        );
      } else if (cond === 'third_group' && part.groups) {
        match = Object.values(part.groups as Record<string, string[]>).some(
          (g) => g[2].toLowerCase() === lowerTeam,
        );
      } else if (cond === 'eliminated_groups' && part.r32) {
        match = !part.r32
          .flat()
          .map((t) => t?.toLowerCase())
          .includes(lowerTeam);
      } else if (cond === 'passes_groups' && part.r32) {
        match = part.r32
          .flat()
          .map((t) => t?.toLowerCase())
          .includes(lowerTeam);
      } else if (cond === 'passes_as_third' && part.r32 && part.groups) {
        match =
          part.r32
            .flat()
            .map((t) => t?.toLowerCase())
            .includes(lowerTeam) &&
          Object.values(part.groups as Record<string, string[]>).some(
            (g) => g[2] && g[2].toLowerCase() === lowerTeam,
          );
      } else if (cond === 'reaches_r16' && part.r16) {
        match = part.r16
          .flat()
          .map((t) => t?.toLowerCase())
          .includes(lowerTeam);
      } else if (cond === 'reaches_qf' && part.qf) {
        match = part.qf
          .flat()
          .map((t) => t?.toLowerCase())
          .includes(lowerTeam);
      } else if (cond === 'reaches_sf' && part.sf) {
        match = part.sf
          .flat()
          .map((t) => t?.toLowerCase())
          .includes(lowerTeam);
      } else if (cond === 'reaches_final' && part.final) {
        match = part.final.map((t) => t?.toLowerCase()).includes(lowerTeam);
      } else if (cond === 'is_runnerup' && part.final && part.champion) {
        match =
          part.final.map((t) => t?.toLowerCase()).includes(lowerTeam) &&
          part.champion.toLowerCase() !== lowerTeam;
      } else if (cond === 'is_champion' && part.champion) {
        match = part.champion.toLowerCase() === lowerTeam;
      }

      if (match) {
        matches.push({ name: uName, id: p.key });
      } else {
        nonMatches.push({ name: uName, id: p.key });
      }
    });

    return { teamResults: matches, teamNegativeResults: nonMatches };
  }, [selectedTeam, selectedCondition, participantsHashes]);

  const globalFrequencies = useMemo(() => {
    const freqs: Record<string, number> = {};

    const increment = (type: string, team: string | null | undefined) => {
      if (!team || team.includes('º')) return;
      const key = `${type}:${team}`;
      freqs[key] = (freqs[key] || 0) + 1;
    };

    participantsHashes.forEach((p) => {
      const part = p.data;
      if (!part) return;

      if (part.groups) {
        Object.values(part.groups as Record<string, string[]>).forEach((g) => {
          increment('1st_group', g[0]);
          increment('2nd_group', g[1]);
          increment('3rd_group', g[2]);
          increment('4th_group', g[3]);
        });
      }
      if (part.r32) part.r32.flat().forEach((t) => increment('passes_groups', t));

      if (part.r32) {
        const r32Flat = part.r32.flat();
        Object.keys(countryCodeMap).forEach((t) => {
          if (t && !t.includes('º') && !r32Flat.includes(t)) {
            increment('eliminated_groups', t);
          }
        });
      }

      if (part.r16) part.r16.flat().forEach((t) => increment('reaches_r16', t));
      if (part.qf) part.qf.flat().forEach((t) => increment('reaches_qf', t));
      if (part.sf) part.sf.flat().forEach((t) => increment('reaches_sf', t));
      if (part.final) part.final.forEach((t) => increment('reaches_final', t));
      if (part.champion) increment('is_champion', part.champion);
      if (part.scorer) increment('is_scorer', part.scorer);
    });

    return freqs;
  }, [participantsHashes]);

  const userStats = useMemo(() => {
    if (!selectedUser) return null;
    const targetHashObj = participantsHashes.find((p) => {
      const part = p.data;
      return part && (part.user || p.participantName || 'Anónimo') === selectedUser;
    });
    if (!targetHashObj) return null;

    const targetPart = targetHashObj.data;
    if (!targetPart) return null;

    const madness: string[] = [];
    if (targetPart.qf) {
      targetPart.qf.flat().forEach((t) => {
        if (t && !t.includes('º') && !topTeams.includes(t)) {
          if (!madness.includes(t)) madness.push(t);
        }
      });
    }

    const haters: string[] = [];
    if (targetPart.r32) {
      const qualified = targetPart.r32.flat();
      topTeams.forEach((t) => {
        if (!qualified.includes(t)) haters.push(t);
      });
    }

    const asylumMap: Record<string, string[]> = {};
    const checkUnique = (type: string, team: string | null | undefined, label: string) => {
      if (!team || team.includes('º')) return;
      if (globalFrequencies[`${type}:${team}`] === 1) {
        if (!asylumMap[team]) asylumMap[team] = [];
        if (!asylumMap[team].includes(label)) asylumMap[team].push(label);
      }
    };

    if (targetPart.groups) {
      Object.values(targetPart.groups).forEach((g) => {
        checkUnique('1st_group', g[0], '1º de Grupo');
        checkUnique('2nd_group', g[1], '2º de Grupo');
        checkUnique('3rd_group', g[2], '3º de Grupo');
        checkUnique('4th_group', g[3], '4º de Grupo');
      });
    }
    if (targetPart.r32)
      targetPart.r32.flat().forEach((t) => checkUnique('passes_groups', t, 'Pasa de Grupos'));

    if (targetPart.r32) {
      const r32Flat = targetPart.r32.flat();
      Object.keys(countryCodeMap).forEach((t) => {
        if (t && !t.includes('º') && !r32Flat.includes(t)) {
          checkUnique('eliminated_groups', t, 'Cae en Grupos');
        }
      });
    }
    if (targetPart.r16)
      targetPart.r16.flat().forEach((t) => checkUnique('reaches_r16', t, 'A Octavos'));
    if (targetPart.qf)
      targetPart.qf.flat().forEach((t) => checkUnique('reaches_qf', t, 'A Cuartos'));
    if (targetPart.sf) targetPart.sf.flat().forEach((t) => checkUnique('reaches_sf', t, 'A Semis'));
    if (targetPart.final)
      targetPart.final.forEach((t) => checkUnique('reaches_final', t, 'A la Final'));
    if (targetPart.champion) checkUnique('is_champion', targetPart.champion, 'Campeón');
    if (targetPart.scorer && globalFrequencies[`is_scorer:${targetPart.scorer}`] === 1) {
      if (!asylumMap[targetPart.scorer]) asylumMap[targetPart.scorer] = [];
      asylumMap[targetPart.scorer].push('Pichichi');
    }

    const asylum = Object.entries(asylumMap).map(([team, labels]) => ({ team, labels }));

    let similarity = 0;
    if (userName && userName !== selectedUser) {
      const myHashObj = participantsHashes.find((p) => {
        const part = p.data;
        return part && (part.user || p.participantName) === userName;
      });
      if (myHashObj?.data) {
        const myPart = myHashObj.data;
        let totalMatches = 0;
        let possibleMatches = 0;

        const compareRound = (
          arr1: (TeamPair | string)[] | undefined,
          arr2: (TeamPair | string)[] | undefined,
        ) => {
          if (!arr1 || !arr2) return;
          const flat1 = arr1.flat().filter((t): t is string => Boolean(t) && !t!.includes('º'));
          const flat2 = arr2.flat().filter((t): t is string => Boolean(t) && !t!.includes('º'));
          possibleMatches += flat2.length;
          flat1.forEach((t) => {
            if (flat2.includes(t)) totalMatches++;
          });
        };

        compareRound(myPart.r32, targetPart.r32);
        compareRound(myPart.r16, targetPart.r16);
        compareRound(myPart.qf, targetPart.qf);
        compareRound(myPart.sf, targetPart.sf);
        compareRound(myPart.final, targetPart.final);
        if (myPart.champion && targetPart.champion && !myPart.champion.includes('º')) {
          possibleMatches += 2;
          if (myPart.champion === targetPart.champion) totalMatches += 2;
        }

        if (possibleMatches > 0) {
          similarity = Math.round((totalMatches / possibleMatches) * 100);
        }
      }
    }

    return {
      ...targetPart,
      /** Clave del pronóstico, para abrirlo en el visor. */
      id: targetHashObj.key,
      madness,
      haters,
      asylum,
      similarity,
    };
  }, [selectedUser, participantsHashes, userName, globalFrequencies]);

  return { allTeams, allUsers, teamResults, teamNegativeResults, userStats };
}
