/**
 * Cuadro de un torneo de tenis en la pestaña Cuadro: las rondas eliminatorias en columnas, con cada
 * partido colocado bajo el que alimenta, y la fase de grupos de las ATP Finals con su clasificación.
 * Se ve con el ganador real o con el que ha predicho el usuario.
 */
import type { MatchdayFixture } from '../types/api';
import { parseTennisScore } from './tennisScore';

/** Id externo de las competiciones de tenis (`tennis.atp.172`, `tennis.wta.189`). */
const TENNIS_PREFIX = 'tennis.';

export const isTennisCompetition = (externalId: string | null | undefined) =>
  Boolean(externalId?.trim().toLowerCase().startsWith(TENNIS_PREFIX));

/** Lo que enseña el cuadro: quién ha ganado de verdad o quién ha predicho el usuario que gana. */
export type DrawView = 'results' | 'predictions';

/** Nombre de la fase de grupos de las ATP Finals (la jornada que da el backend). */
export const GROUP_STAGE = 'Fase de grupos';

/** Rondas que se pronostican, desde octavos, con los partidos de cada una en un cuadro completo. */
const KNOCKOUT_ROUNDS = [
  { label: 'Octavos de final', slots: 8 },
  { label: 'Cuartos de final', slots: 4 },
  { label: 'Semifinales', slots: 2 },
  { label: 'Final', slots: 1 },
] as const;

const PLACEHOLDER = 'Por definir';

type Sign = '1' | '2';

const isPlayer = (name: string | null | undefined) =>
  Boolean(name && name.trim() && name !== PLACEHOLDER);

/** Ganador real: también tras una retirada o un W.O., que no tienen marcador. */
export function actualWinner(fixture: MatchdayFixture): Sign | null {
  if (fixture.winnerSign === '1' || fixture.winnerSign === '2') return fixture.winnerSign;
  if (!fixture.finished) return null;
  const home = fixture.actualHomeScore;
  const away = fixture.actualAwayScore;
  if (home == null || away == null || home === away) return null;
  return home > away ? '1' : '2';
}

/** Ganador según la predicción del usuario (su marcador de sets); null si no la hizo. */
export function predictedWinner(fixture: MatchdayFixture): Sign | null {
  if (fixture.predSign === '1' || fixture.predSign === '2') return fixture.predSign;
  const home = fixture.predHomeScore;
  const away = fixture.predAwayScore;
  if (home == null || away == null || home === away) return null;
  return home > away ? '1' : '2';
}

const winnerFor = (fixture: MatchdayFixture, view: DrawView) =>
  view === 'results' ? actualWinner(fixture) : predictedWinner(fixture);

/** Clave de un jugador: su id si lo tiene; si no, su nombre. */
const playerKey = (id: number | null, name: string) => (id != null ? `id:${id}` : `name:${name}`);
const homeKey = (f: MatchdayFixture) => playerKey(f.homeTeamId, f.homeTeam);
const awayKey = (f: MatchdayFixture) => playerKey(f.awayTeamId, f.awayTeam);

export interface DrawSlot {
  /** Partido publicado en este hueco del cuadro; null si aún no se conoce. */
  fixture: MatchdayFixture | null;
  /**
   * En la vista de predicciones, quién llegaría a un hueco aún vacío según lo que ha predicho el
   * usuario en los partidos que lo alimentan.
   */
  projected?: { home: string | null; away: string | null };
}

export interface DrawRound {
  label: string;
  slots: DrawSlot[];
}

/** Partidos más pronto primero; a igual fecha, por id (el orden de importación). */
const byDate = (a: MatchdayFixture, b: MatchdayFixture) =>
  (a.matchDate ?? '￿').localeCompare(b.matchDate ?? '￿') || a.matchId - b.matchId;

/**
 * Rondas eliminatorias desde la primera con partidos hasta la final, con los huecos de un cuadro
 * completo. ESPN no da la posición de cada partido en el cuadro: se deduce de la final hacia atrás
 * (cada partido va debajo del que juega su ganador) y lo que aún no se puede enlazar va por fecha.
 */
export function knockoutRounds(fixtures: MatchdayFixture[], view: DrawView): DrawRound[] {
  const byRound = KNOCKOUT_ROUNDS.map((round) =>
    fixtures.filter((f) => f.round === round.label).sort(byDate),
  );
  const first = byRound.findIndex((list) => list.length > 0);
  if (first < 0) return [];
  const rounds = KNOCKOUT_ROUNDS.slice(first);
  const lists = byRound.slice(first);

  const placed: (MatchdayFixture | null)[][] = rounds.map((round) =>
    Array.from({ length: round.slots }, () => null),
  );
  // La última ronda tal cual; cada anterior, debajo de los partidos de la siguiente.
  const last = rounds.length - 1;
  lists[last].slice(0, rounds[last].slots).forEach((f, i) => (placed[last][i] = f));
  for (let r = last - 1; r >= 0; r--) {
    const pending = [...lists[r]];
    const take = (key: string) => {
      const index = pending.findIndex((f) => homeKey(f) === key || awayKey(f) === key);
      return index < 0 ? null : pending.splice(index, 1)[0];
    };
    placed[r + 1].forEach((parent, k) => {
      if (!parent) return;
      if (isPlayer(parent.homeTeam)) placed[r][2 * k] = take(homeKey(parent));
      if (isPlayer(parent.awayTeam)) placed[r][2 * k + 1] = take(awayKey(parent));
    });
    // Lo que no se ha podido enlazar: primero bajo los partidos de la siguiente ronda con un hueco
    // libre, luego en los huecos que queden, por fecha.
    const free = placed[r]
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot == null)
      .map(({ index }) => index)
      .sort((a, b) => Number(!placed[r + 1][a >> 1]) - Number(!placed[r + 1][b >> 1]) || a - b);
    pending.slice(0, free.length).forEach((f, i) => (placed[r][free[i]] = f));
  }

  return rounds.map((round, r) => ({
    label: round.label,
    slots: placed[r].map((fixture, k) => {
      if (fixture || r === 0 || view !== 'predictions') return { fixture };
      const advance = (feeder: MatchdayFixture | null) => {
        const sign = feeder ? predictedWinner(feeder) : null;
        if (!feeder || !sign) return null;
        const name = sign === '1' ? feeder.homeTeam : feeder.awayTeam;
        return isPlayer(name) ? name : null;
      };
      const home = advance(placed[r - 1][2 * k]);
      const away = advance(placed[r - 1][2 * k + 1]);
      return home || away ? { fixture, projected: { home, away } } : { fixture };
    }),
  }));
}

interface GroupRow {
  key: string;
  name: string;
  logo: string | null;
  played: number;
  won: number;
  lost: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
}

export interface DrawGroup {
  /** «Grupo A», «Grupo B» o, si aún no se distinguen, «Fase de grupos». */
  name: string;
  rows: GroupRow[];
  fixtures: MatchdayFixture[];
  /** Todos los partidos del grupo tienen ganador en esta vista. */
  complete: boolean;
}

/** Jugadores que pasan a semifinales: los que ya están en ellas o, con el grupo acabado, los dos primeros. */
export function qualifiedKeys(group: DrawGroup, semifinals: MatchdayFixture[], view: DrawView) {
  if (view === 'results') {
    const known = new Set(
      semifinals.flatMap((f) => [
        ...(isPlayer(f.homeTeam) ? [homeKey(f)] : []),
        ...(isPlayer(f.awayTeam) ? [awayKey(f)] : []),
      ]),
    );
    const inGroup = group.rows.filter((row) => known.has(row.key)).map((row) => row.key);
    if (inGroup.length > 0) return new Set(inGroup);
  }
  return new Set(group.complete ? group.rows.slice(0, 2).map((row) => row.key) : []);
}

/** Sets del partido en la vista; una retirada o un W.O. no tienen. */
const setsOf = (fixture: MatchdayFixture, view: DrawView) =>
  view === 'results'
    ? { home: fixture.actualHomeScore, away: fixture.actualAwayScore }
    : { home: fixture.predHomeScore, away: fixture.predAwayScore };

/**
 * Clasificación de un grupo: victorias, luego (entre dos empatados) quién ganó el duelo y después el
 * porcentaje de sets y el de juegos ganados, como en las ATP Finals.
 */
function standings(fixtures: MatchdayFixture[], view: DrawView): GroupRow[] {
  const rows = new Map<string, GroupRow>();
  const row = (key: string, name: string, logo: string | null) => {
    let found = rows.get(key);
    if (!found) {
      found = {
        key,
        name,
        logo,
        played: 0,
        won: 0,
        lost: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
      };
      rows.set(key, found);
    }
    return found;
  };
  const duels = new Map<string, string>();
  for (const fixture of fixtures) {
    const home = isPlayer(fixture.homeTeam)
      ? row(homeKey(fixture), fixture.homeTeam, fixture.homeTeamLogo)
      : null;
    const away = isPlayer(fixture.awayTeam)
      ? row(awayKey(fixture), fixture.awayTeam, fixture.awayTeamLogo)
      : null;
    const sign = winnerFor(fixture, view);
    if (!home || !away || !sign) continue;
    const [winner, loser] = sign === '1' ? [home, away] : [away, home];
    winner.played++;
    loser.played++;
    winner.won++;
    loser.lost++;
    duels.set(`${winner.key}>${loser.key}`, winner.key);
    const sets = setsOf(fixture, view);
    if (sets && sets.home != null && sets.away != null) {
      home.setsWon += sets.home;
      home.setsLost += sets.away;
      away.setsWon += sets.away;
      away.setsLost += sets.home;
    }
    // Los juegos solo se conocen del resultado real.
    const games = view === 'results' ? parseTennisScore(fixture.displayClock) : null;
    for (const set of games?.sets ?? []) {
      home.gamesWon += set.home;
      home.gamesLost += set.away;
      away.gamesWon += set.away;
      away.gamesLost += set.home;
    }
  }
  const setRatio = (r: GroupRow) =>
    r.setsWon + r.setsLost ? r.setsWon / (r.setsWon + r.setsLost) : 0;
  const gameRatio = (r: GroupRow) =>
    r.gamesWon + r.gamesLost ? r.gamesWon / (r.gamesWon + r.gamesLost) : 0;
  const list = [...rows.values()];
  return list.sort((a, b) => {
    if (b.won !== a.won) return b.won - a.won;
    const tied = list.filter((r) => r.won === a.won);
    if (tied.length === 2) {
      if (duels.has(`${a.key}>${b.key}`)) return -1;
      if (duels.has(`${b.key}>${a.key}`)) return 1;
    }
    return (
      setRatio(b) - setRatio(a) ||
      gameRatio(b) - gameRatio(a) ||
      a.lost - b.lost ||
      a.name.localeCompare(b.name, 'es')
    );
  });
}

/**
 * Grupos de las ATP Finals. ESPN no dice en qué grupo está cada jugador: se deduce de quién juega con
 * quién (dos grupos de cuatro). Mientras no se distinguen (las dos primeras jornadas), una sola tabla.
 */
export function groupStage(fixtures: MatchdayFixture[], view: DrawView): DrawGroup[] {
  const matches = fixtures.filter((f) => f.round === GROUP_STAGE).sort(byDate);
  if (matches.length === 0) return [];
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    const up = parent.get(key) ?? key;
    if (up === key) return key;
    const root = find(up);
    parent.set(key, root);
    return root;
  };
  for (const f of matches) {
    if (!isPlayer(f.homeTeam) || !isPlayer(f.awayTeam)) continue;
    const a = find(homeKey(f));
    const b = find(awayKey(f));
    parent.set(a, a);
    if (a !== b) parent.set(b, a);
  }
  const components = new Map<string, MatchdayFixture[]>();
  for (const f of matches) {
    const key = isPlayer(f.homeTeam)
      ? find(homeKey(f))
      : isPlayer(f.awayTeam)
        ? find(awayKey(f))
        : '';
    components.set(key, [...(components.get(key) ?? []), f]);
  }
  const make = (name: string, list: MatchdayFixture[]): DrawGroup => ({
    name,
    rows: standings(list, view),
    fixtures: list,
    complete: list.every((f) => winnerFor(f, view) != null),
  });
  const groups = [...components.values()];
  const players = (list: MatchdayFixture[]) =>
    new Set(list.flatMap((f) => [homeKey(f), awayKey(f)])).size;
  const separated = groups.length === 2 && groups.every((list) => players(list) === 4);
  if (!separated) return [make(GROUP_STAGE, matches)];
  // El grupo del primer partido es el A.
  return groups.map((list, i) => make(`Grupo ${String.fromCharCode(65 + i)}`, list));
}

export interface TennisDraw {
  /** Cuadro (masculino, femenino) o torneo cuando la liga junta varios; null si solo hay uno. */
  name: string | null;
  groups: DrawGroup[];
  rounds: DrawRound[];
}

const TOURNAMENT_SEPARATOR = ' · ';

/**
 * Torneo y ronda de una jornada. En una liga de varios torneos el backend las llama «Roland Garros 2027 ·
 * Octavos de final»; en la de un torneo, solo la ronda.
 */
export function splitRound(round: string): { tournament: string | null; round: string } {
  const at = round.lastIndexOf(TOURNAMENT_SEPARATOR);
  return at < 0
    ? { tournament: null, round }
    : { tournament: round.slice(0, at), round: round.slice(at + TOURNAMENT_SEPARATOR.length) };
}

/**
 * Nombre de un cuadro: la competición («Roland Garros · masculino») o, en una liga de varios torneos, el
 * torneo con su año y el cuadro («Roland Garros 2027 · masculino»).
 */
function drawName(competition: string, tournament: string | null): string {
  if (!tournament) return competition;
  const at = competition.indexOf(TOURNAMENT_SEPARATOR);
  return at < 0 ? tournament : tournament + competition.slice(at);
}

/**
 * Un cuadro por competición de la liga (y por edición, si sigue varios torneos), en el orden en que
 * llegan sus partidos.
 */
export function tennisDraws(fixtures: MatchdayFixture[], view: DrawView): TennisDraw[] {
  const byCompetition = new Map<string, MatchdayFixture[]>();
  for (const fixture of [...fixtures].sort(byDate)) {
    const { tournament, round } = splitRound(fixture.round ?? '');
    const name = drawName(fixture.competitionName ?? '', tournament);
    const plain = fixture.round == null ? fixture : { ...fixture, round };
    byCompetition.set(name, [...(byCompetition.get(name) ?? []), plain]);
  }
  return [...byCompetition.entries()]
    .map(([name, list]) => ({
      name: name || null,
      groups: groupStage(list, view),
      rounds: knockoutRounds(list, view),
    }))
    .filter((draw) => draw.groups.length > 0 || draw.rounds.length > 0);
}

/** Lo que enseña un jugador en un partido del cuadro según la vista. */
export interface SideState {
  /** Pasa de ronda en esta vista (ganador real o elegido por el usuario). */
  advances: boolean;
  /** Eliminado de verdad (solo en la vista de resultados). */
  out: boolean;
  /** En la vista de predicciones, el jugador elegido y si se ha acertado. */
  outcome: 'picked' | 'hit' | 'miss' | null;
}

export function sideState(
  fixture: MatchdayFixture,
  side: 'home' | 'away',
  view: DrawView,
): SideState {
  const sign: Sign = side === 'home' ? '1' : '2';
  const actual = actualWinner(fixture);
  const predicted = predictedWinner(fixture);
  if (view === 'results') {
    return {
      advances: actual === sign,
      out: actual != null && actual !== sign,
      outcome: null,
    };
  }
  const picked = predicted === sign;
  return {
    advances: picked,
    out: false,
    outcome: !picked ? null : actual == null ? 'picked' : actual === sign ? 'hit' : 'miss',
  };
}
