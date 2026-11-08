import type {
  Competition,
  MatchSelectionRequest,
  MatchSelectionView,
  SelectableMatch,
  SelectableTeam,
} from '../../types/api';

/** Cómo se eligen los partidos: todos, los de unos equipos o uno a uno. */
export type PickMode = 'ALL' | 'TEAMS' | 'PICK';

/**
 * Selección mientras se edita. Con equipos, `included` y `excluded` son los cambios a mano sobre sus
 * partidos; eligiendo uno a uno, `included` son los elegidos. `competitionIds` son las competiciones de
 * la liga con la principal primero; vacía, solo la principal.
 */
export interface SelectionValue {
  mode: PickMode;
  teamIds: number[];
  included: number[];
  excluded: number[];
  competitionIds: number[];
}

export const ALL_MATCHES: SelectionValue = {
  mode: 'ALL',
  teamIds: [],
  included: [],
  excluded: [],
  competitionIds: [],
};

/** Competiciones del calendario que se están cargando de ESPN y avisos de las que no se han podido. */
export interface CalendarImports {
  loading: string[];
  errors: string[];
}

export function calendarImports(
  view: Pick<MatchSelectionView, 'competitions'> | null | undefined,
): CalendarImports {
  const competitions = view?.competitions ?? [];
  return {
    loading: competitions.filter((item) => item.importing).map((item) => item.name),
    errors: competitions.flatMap((item) => (item.importError ? [item.importError] : [])),
  };
}

/** Si alguna competición del calendario se está cargando: hay que volver a pedirlo hasta que llegue. */
export const isImporting = (view: Pick<MatchSelectionView, 'competitions'> | null | undefined) =>
  view?.competitions.some((item) => item.importing) ?? false;

/** Competiciones que puede juntar una liga, contando la suya (como en el servidor). */
export const MAX_COMPETITIONS = 8;

/** La liga junta partidos de varias competiciones: sus jornadas son semanas y no admite «todos». */
export const isMultiCompetition = (value: SelectionValue) => value.competitionIds.length > 1;

/** Si el partido es de una de las competiciones de la liga. */
const inCompetitions = (value: SelectionValue, match: SelectableMatch) =>
  value.competitionIds.length === 0 ||
  match.competitionId == null ||
  value.competitionIds.includes(match.competitionId);

/**
 * Añade o quita una competición. Al juntar varias ya no caben «todos los partidos»: se pasa a elegirlos
 * a mano. Lo elegido a mano de una competición quitada se descarta.
 */
export function toggleCompetition(
  value: SelectionValue,
  primaryId: number,
  competitionId: number,
  checked: boolean,
  matches: SelectableMatch[],
): SelectionValue {
  if (competitionId === primaryId) return value;
  const others = value.competitionIds.filter((id) => id !== primaryId && id !== competitionId);
  if (checked) others.push(competitionId);
  const next: SelectionValue = { ...value, competitionIds: [primaryId, ...others] };
  if (!checked) {
    const gone = new Set(
      matches.filter((match) => match.competitionId === competitionId).map((match) => match.id),
    );
    next.included = value.included.filter((id) => !gone.has(id));
    next.excluded = value.excluded.filter((id) => !gone.has(id));
  }
  if (isMultiCompetition(next) && next.mode === 'ALL') {
    return { ...next, mode: 'PICK', teamIds: [], included: [], excluded: [] };
  }
  return next;
}

/**
 * Competiciones que se pueden añadir a una liga: oficiales, del mismo deporte que la principal y sin
 * terminar, más las que ya tiene aunque hayan terminado.
 */
export function addableCompetitions(
  competitions: Competition[],
  primaryId: number,
  current: number[],
): Competition[] {
  const primary = competitions.find((item) => item.id === primaryId);
  return competitions.filter(
    (item) =>
      item.id !== primaryId &&
      (current.includes(item.id) || (!item.finished && item.sport === primary?.sport)),
  );
}

/** Competiciones de la liga según la selección: las elegidas o solo la principal. */
export const leagueCompetitionIds = (value: SelectionValue, primaryId: number | null): number[] =>
  value.competitionIds.length > 0 ? value.competitionIds : primaryId != null ? [primaryId] : [];

/**
 * Calendario que se edita en la administración: el de las competiciones elegidas, con lo que el
 * servidor sabe de cada partido que ya era de la liga (si entra, predicciones, si está cerrado). La
 * jornada es la del calendario, que ya agrupa por semanas si la liga junta varias competiciones.
 */
export function mergeCalendar(
  saved: SelectableMatch[],
  calendar: SelectableMatch[] | undefined,
): SelectableMatch[] {
  if (!calendar) return saved;
  const known = new Map(saved.map((match) => [match.id, match]));
  return calendar.map((match) => {
    const current = known.get(match.id);
    return current
      ? { ...current, round: match.round }
      : { ...match, selected: false, locked: false, predictions: 0 };
  });
}

/** Competiciones de la liga para el resumen: «LaLiga, Champions y Premier». */
export function describeCompetitions(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

export const PICK_MODES: { value: PickMode; title: string; text: string }[] = [
  {
    value: 'ALL',
    title: 'Todos los partidos',
    text: 'Toda la competición.',
  },
  {
    value: 'TEAMS',
    title: 'Los de un equipo',
    text: 'Para la peña de un club. Los partidos nuevos entran solos.',
  },
  {
    value: 'PICK',
    title: 'Elegidos a mano',
    text: 'Solo los que marques.',
  },
];

/** Lo guardado en el servidor, como se edita. */
export function fromView(
  view: Pick<
    MatchSelectionView,
    'mode' | 'teamIds' | 'includedMatchIds' | 'excludedMatchIds' | 'competitionIds'
  >,
): SelectionValue {
  const competitionIds = [...view.competitionIds];
  if (view.mode === 'ALL') return { ...ALL_MATCHES, competitionIds };
  return {
    mode: view.teamIds.length > 0 ? 'TEAMS' : 'PICK',
    teamIds: [...view.teamIds],
    included: [...view.includedMatchIds],
    excluded: [...view.excludedMatchIds],
    competitionIds,
  };
}

const followed = (value: SelectionValue, match: SelectableMatch) =>
  value.mode === 'TEAMS' &&
  ((match.homeTeamId != null && value.teamIds.includes(match.homeTeamId)) ||
    (match.awayTeamId != null && value.teamIds.includes(match.awayTeamId)));

/** Si el partido entra. Uno cerrado con predicciones que ya estaba se queda pase lo que pase. */
export function isSelected(value: SelectionValue, match: SelectableMatch): boolean {
  if (match.locked && match.selected) return true;
  if (!inCompetitions(value, match)) return false;
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
  const { competitionIds } = value;
  if (mode === 'ALL') return isMultiCompetition(value) ? value : { ...ALL_MATCHES, competitionIds };
  if (mode === 'TEAMS') return { mode, teamIds: [], included: [], excluded: [], competitionIds };
  const kept = value.mode === 'TEAMS' ? matches.filter((match) => isSelected(value, match)) : [];
  return {
    mode,
    teamIds: [],
    included: kept.map((match) => match.id),
    excluded: [],
    competitionIds,
  };
}

/** Petición al servidor, sin los cambios a mano que ya no apuntan a ningún partido de un equipo. */
export function toRequest(
  value: SelectionValue,
  matches?: SelectableMatch[],
): MatchSelectionRequest {
  const competitions =
    value.competitionIds.length > 0 ? { competitionIds: value.competitionIds } : {};
  if (value.mode === 'ALL') return { mode: 'ALL', ...competitions };
  if (value.mode === 'PICK')
    return { mode: 'CUSTOM', teamIds: [], includedMatchIds: value.included, ...competitions };
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
    ...competitions,
  };
}

/** Qué falta para poder guardar, o null. */
export function selectionError(value: SelectionValue): string | null {
  if (value.mode === 'ALL' && isMultiCompetition(value))
    return 'Con varias competiciones, elige los equipos o los partidos.';
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
