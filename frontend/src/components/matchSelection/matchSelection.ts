import type {
  MatchSelectionRequest,
  MatchSelectionView,
  SelectableMatch,
  SelectableTeam,
} from '../../types/api';

/** Cómo se eligen los partidos: todos, los de unos equipos o uno a uno. */
export type PickMode = 'ALL' | 'TEAMS' | 'PICK';

/**
 * Selección mientras se edita. Con equipos, `included` y `excluded` son los cambios a mano sobre sus
 * partidos; eligiendo uno a uno, `included` son los elegidos.
 */
export interface SelectionValue {
  mode: PickMode;
  teamIds: number[];
  included: number[];
  excluded: number[];
}

export const ALL_MATCHES: SelectionValue = { mode: 'ALL', teamIds: [], included: [], excluded: [] };

export const PICK_MODES: { value: PickMode; title: string; text: string }[] = [
  {
    value: 'ALL',
    title: 'Todos los partidos',
    text: 'Entra cada partido de la competición.',
  },
  {
    value: 'TEAMS',
    title: 'Los de un equipo',
    text: 'Para la peña de un club: entran sus partidos, también los que se publiquen más adelante.',
  },
  {
    value: 'PICK',
    title: 'Elegidos a mano',
    text: 'Solo los partidos que marques, por ejemplo los destacados de cada jornada.',
  },
];

/** Lo guardado en el servidor, como se edita. */
export function fromView(
  view: Pick<MatchSelectionView, 'mode' | 'teamIds' | 'includedMatchIds' | 'excludedMatchIds'>,
): SelectionValue {
  if (view.mode === 'ALL') return ALL_MATCHES;
  return {
    mode: view.teamIds.length > 0 ? 'TEAMS' : 'PICK',
    teamIds: [...view.teamIds],
    included: [...view.includedMatchIds],
    excluded: [...view.excludedMatchIds],
  };
}

const followed = (value: SelectionValue, match: SelectableMatch) =>
  value.mode === 'TEAMS' &&
  ((match.homeTeamId != null && value.teamIds.includes(match.homeTeamId)) ||
    (match.awayTeamId != null && value.teamIds.includes(match.awayTeamId)));

/** Si el partido entra. Uno cerrado con predicciones que ya estaba se queda pase lo que pase. */
export function isSelected(value: SelectionValue, match: SelectableMatch): boolean {
  if (match.locked && match.selected) return true;
  if (value.mode === 'ALL') return true;
  if (value.excluded.includes(match.id)) return false;
  return value.included.includes(match.id) || followed(value, match);
}

const without = (ids: number[], id: number) => ids.filter((item) => item !== id);

export function toggleMatch(
  value: SelectionValue,
  match: SelectableMatch,
  checked: boolean,
): SelectionValue {
  const byTeam = followed(value, match);
  const included = without(value.included, match.id);
  const excluded = without(value.excluded, match.id);
  if (checked && !byTeam) included.push(match.id);
  if (!checked && byTeam) excluded.push(match.id);
  return { ...value, included, excluded };
}

export function toggleTeam(
  value: SelectionValue,
  teamId: number,
  checked: boolean,
): SelectionValue {
  const teamIds = without(value.teamIds, teamId);
  if (checked) teamIds.push(teamId);
  return { ...value, teamIds };
}

/** Al pasar de equipos a elegir a mano se conservan los partidos que ya entraban. */
export function switchMode(
  value: SelectionValue,
  mode: PickMode,
  matches: SelectableMatch[],
): SelectionValue {
  if (mode === value.mode) return value;
  if (mode === 'ALL') return ALL_MATCHES;
  if (mode === 'TEAMS') return { mode, teamIds: [], included: [], excluded: [] };
  const kept = value.mode === 'TEAMS' ? matches.filter((match) => isSelected(value, match)) : [];
  return { mode, teamIds: [], included: kept.map((match) => match.id), excluded: [] };
}

/** Petición al servidor, sin los cambios a mano que ya no apuntan a ningún partido de un equipo. */
export function toRequest(
  value: SelectionValue,
  matches?: SelectableMatch[],
): MatchSelectionRequest {
  if (value.mode === 'ALL') return { mode: 'ALL' };
  if (value.mode === 'PICK')
    return { mode: 'CUSTOM', teamIds: [], includedMatchIds: value.included };
  const excluded = matches
    ? value.excluded.filter((id) => {
        const match = matches.find((item) => item.id === id);
        return match != null && followed(value, match);
      })
    : value.excluded;
  return {
    mode: 'CUSTOM',
    teamIds: value.teamIds,
    includedMatchIds: value.included,
    excludedMatchIds: excluded,
  };
}

/** Qué falta para poder guardar, o null. */
export function selectionError(value: SelectionValue): string | null {
  if (value.mode === 'TEAMS' && value.teamIds.length === 0) return 'Elige al menos un equipo.';
  if (value.mode === 'PICK' && value.included.length === 0) return 'Elige al menos un partido.';
  return null;
}

/** Predicciones que se borrarían al guardar: las de partidos abiertos que dejan de entrar. */
export function removedPredictions(value: SelectionValue, matches: SelectableMatch[]): number {
  return matches
    .filter((match) => match.selected && !match.locked && !isSelected(value, match))
    .reduce((total, match) => total + match.predictions, 0);
}

/** Frase corta de lo elegido. */
export function describeSelection(
  value: SelectionValue,
  teams: SelectableTeam[],
  matches: SelectableMatch[],
): string {
  if (value.mode === 'ALL') return 'Todos los partidos';
  const count = matches.filter((match) => isSelected(value, match)).length;
  const total = `${count} ${count === 1 ? 'partido' : 'partidos'}`;
  if (value.mode === 'PICK') return `${count === 1 ? 'Elegido' : 'Elegidos'} a mano: ${total}`;
  const names = teams.filter((team) => value.teamIds.includes(team.id)).map((team) => team.name);
  const who = names.length > 0 ? names.join(', ') : `${value.teamIds.length} equipos`;
  return `De ${who}: ${total}`;
}

export interface RoundGroup {
  round: string;
  matches: SelectableMatch[];
  /** Todos sus partidos ya han cerrado. */
  closed: boolean;
}

/** Partidos por jornada, en el orden en que llegan (por fecha). */
export function groupByRound(matches: SelectableMatch[]): RoundGroup[] {
  const groups = new Map<string, SelectableMatch[]>();
  for (const match of matches) {
    const list = groups.get(match.round);
    if (list) list.push(match);
    else groups.set(match.round, [match]);
  }
  return [...groups.entries()].map(([round, list]) => ({
    round,
    matches: list,
    closed: list.every((match) => match.closed),
  }));
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Partidos en los que juega un equipo cuyo nombre contiene el texto. */
export function matchesQuery(match: SelectableMatch, query: string): boolean {
  const wanted = normalize(query.trim());
  if (!wanted) return true;
  return normalize(match.home).includes(wanted) || normalize(match.away).includes(wanted);
}

export function teamsQuery(team: SelectableTeam, query: string): boolean {
  const wanted = normalize(query.trim());
  return !wanted || normalize(team.name).includes(wanted);
}
