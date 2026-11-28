import type {
  BlindClock,
  BlindLevel,
  PokerSession,
  PokerSettings,
} from '../../services/endpoints/poker';

const moneyFormat = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const longDate = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const longDateWithYear = new Intl.DateTimeFormat('es-ES', { dateStyle: 'full' });
const shortDateFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const shortDateWithYear = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });
// En es-ES Intl no agrupa los números de cuatro cifras (4233 junto a 65.767); de-DE usa el mismo
// punto de millares y sí los agrupa.
const numberFormat = new Intl.NumberFormat('de-DE');
const percentFormat = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const signedMoneyFormat = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  signDisplay: 'exceptZero',
});

export const euros = (cents: number) => moneyFormat.format(cents / 100);
export const signedEuros = (cents: number) => signedMoneyFormat.format(cents / 100);
export const chips = (count: number) => numberFormat.format(count);
export const percent = (value: number) => percentFormat.format(value);
const noon = (date: string) => new Date(`${date}T12:00:00`);
/** El año solo se muestra si no es el actual: la mayoría de timbas son de esta temporada. */
const thisYear = (date: Date) => date.getFullYear() === new Date().getFullYear();
export const tournamentDate = (date: string) => {
  const day = noon(date);
  return (thisYear(day) ? longDate : longDateWithYear).format(day);
};
export const upcomingTournamentDate = (date: string) => longDate.format(noon(date));
export const shortDate = (date: string) => {
  const day = noon(date);
  return (thisYear(day) ? shortDateFormat : shortDateWithYear).format(day);
};

/** Quita el cero de delante al escribir detrás de él («020» pasa a «20»). */
export function noLeadingZero(input: HTMLInputElement) {
  if (/^-?0\d/.test(input.value)) input.value = String(input.valueAsNumber);
  return input.valueAsNumber;
}

/** Puntos de la liga con hasta dos decimales: «9», «4,5», «2,25». */
export const pointsText = (points: number) =>
  points.toLocaleString('es-ES', { maximumFractionDigits: 2 });

// En el podio de la liga cuentan los puntos; al lado, las victorias o, si no las hay, los podios.
export const standingLabel = ({
  points,
  wins,
  podiums,
}: {
  points: number;
  wins: number;
  podiums: number;
}) =>
  `${pointsText(points)} ${points === 1 ? 'punto' : 'puntos'} · ` +
  (wins > 0
    ? `${wins} ${wins === 1 ? 'victoria' : 'victorias'}`
    : `${podiums} ${podiums === 1 ? 'podio' : 'podios'}`);

export const today = () => {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

export const defaultSettings: PokerSettings = {
  buyInCents: 0,
  startingChips: 10000,
  rebuy: null,
  addOn: null,
  prizeShares: [60, 30, 10],
  levels: [
    { small: 25, big: 50, ante: 0, minutes: 15 },
    { small: 50, big: 100, ante: 0, minutes: 15 },
    { small: 75, big: 150, ante: 0, minutes: 15 },
    { small: 100, big: 200, ante: 0, minutes: 15 },
    { small: 150, big: 300, ante: 0, minutes: 15 },
    { small: 200, big: 400, ante: 0, minutes: 15 },
    { small: 250, big: 500, ante: 0, minutes: 15 },
    { small: 300, big: 600, ante: 0, minutes: 15 },
    { small: 400, big: 800, ante: 0, minutes: 15 },
    { small: 500, big: 1000, ante: 0, minutes: 15 },
  ],
};

/** Nivel en que se cierra un extra: su corte más los descansos que lo siguen, para comprar en la pausa. */
export function buyUntil(levels: BlindLevel[], throughLevel: number) {
  let end = throughLevel;
  while (end < levels.length && levels[end].big === 0) end++;
  return end;
}

/** Número del nivel de juego: los descansos no cuentan, así que tras «Nivel 2» y el descanso llega «Nivel 3». */
export function playLevelNumber(levels: BlindLevel[], index: number) {
  let count = 0;
  for (let i = 0; i <= index && i < levels.length; i++) if (levels[i].big !== 0) count++;
  return count;
}

/** Cabecera del reloj: «Nivel 3» o, en un descanso, «Tras el nivel 2». */
export function levelHeading(levels: BlindLevel[], index: number) {
  const number = playLevelNumber(levels, index);
  return levels[index]?.big === 0 ? `Tras el nivel ${number}` : `Nivel ${number}`;
}

/** Corte de una compra extra, que se guarda por posición en la lista: «nivel 4 y el descanso». */
export function cutoffText(levels: BlindLevel[], throughLevel: number) {
  const withBreak =
    levels[throughLevel - 1]?.big === 0 || buyUntil(levels, throughLevel) > throughLevel;
  return `nivel ${playLevelNumber(levels, throughLevel - 1)}${withBreak ? ' y el descanso' : ''}`;
}

/** Con el extra activo, deja un descanso justo después de su último nivel para comprar sin prisas. */
export function withBreakAfterCutoff(
  settings: PokerSettings,
  extra: 'rebuy' | 'addOn',
): PokerSettings {
  const cutoff = settings[extra]?.throughLevel;
  const next = cutoff === undefined ? undefined : settings.levels[cutoff];
  // Si el corte cae en un descanso, o ya le sigue uno, ya hay pausa para comprar.
  if (cutoff === undefined || !next || next.big === 0 || settings.levels[cutoff - 1]?.big === 0) {
    return settings;
  }
  const shift = (other: PokerSettings['rebuy']) =>
    other && other.throughLevel > cutoff
      ? { ...other, throughLevel: other.throughLevel + 1 }
      : other;
  return {
    ...settings,
    levels: [
      ...settings.levels.slice(0, cutoff),
      { minutes: 10, small: 0, big: 0, ante: 0 },
      ...settings.levels.slice(cutoff),
    ],
    rebuy: extra === 'rebuy' ? settings.rebuy : shift(settings.rebuy),
    addOn: extra === 'addOn' ? settings.addOn : shift(settings.addOn),
  };
}

export function clockAt(clock: BlindClock, levels: BlindLevel[], now: number): BlindClock {
  if (clock.endsAt === null) return clock;
  let deadline = clock.endsAt;
  let level = clock.level;
  while (deadline <= now && level + 1 < levels.length) {
    level += 1;
    deadline += levels[level].minutes * 60_000;
  }
  return deadline <= now
    ? { level, endsAt: null, remainingMs: 0 }
    : { level, endsAt: deadline, remainingMs: deadline - now };
}

export function timeLabel(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export interface Payment {
  fromId: number;
  from: string;
  /** `null`: lo paga al sobrante, el dinero del bote que no se llevó nadie. */
  toId: number | null;
  to: string;
  cents: number;
}

/** Pagos mínimos para saldar un torneo: quien perdió dinero paga a quien lo ganó. */
export function settlements(results: PokerSession['results']): Payment[] {
  const nets = results
    .map((result) => ({
      id: result.playerId,
      name: result.name,
      cents: result.prizeCents - result.paidCents,
    }))
    .filter((net) => net.cents !== 0);
  const debtors = nets.filter((net) => net.cents < 0).sort((a, b) => a.cents - b.cents);
  const creditors = nets.filter((net) => net.cents > 0).sort((a, b) => b.cents - a.cents);
  const payments: Payment[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const cents = Math.min(-debtors[d].cents, creditors[c].cents);
    payments.push({
      fromId: debtors[d].id,
      from: debtors[d].name,
      toId: creditors[c].id,
      to: creditors[c].name,
      cents,
    });
    debtors[d].cents += cents;
    creditors[c].cents -= cents;
    if (debtors[d].cents === 0) d += 1;
    if (creditors[c].cents === 0) c += 1;
  }
  // Lo que aún deben, con los premios ya pagados, es el sobrante: también se entrega, para cuadrar.
  for (const debtor of debtors.slice(d)) {
    if (debtor.cents < 0) {
      payments.push({
        fromId: debtor.id,
        from: debtor.name,
        toId: null,
        to: 'sobrante',
        cents: -debtor.cents,
      });
    }
  }
  return payments;
}

/**
 * Premio de cada jugador con el bote entero: lo que sobró al repartir (la propina que se propone al
 * crupier) se suma en proporción a lo que se llevó cada uno. Es lo que cuentan las estadísticas; el
 * dinero que cambió de manos sigue siendo `prizeCents`.
 */
export function fullPrizes({
  results,
  leftoverCents,
}: {
  results: { playerId: number; prizeCents: number }[];
  leftoverCents?: number;
}) {
  const handed = results.reduce((sum, result) => sum + result.prizeCents, 0);
  const leftover = leftoverCents ?? 0;
  const prizes = new Map(results.map((result) => [result.playerId, result.prizeCents]));
  if (leftover <= 0 || handed <= 0) return prizes;
  // Céntimos enteros: primero la parte entera y los que faltan, a los restos más grandes.
  const shares = results.map((result, index) => {
    const exact = (leftover * result.prizeCents) / handed;
    return { index, whole: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let spare = leftover - shares.reduce((sum, share) => sum + share.whole, 0);
  for (const share of [...shares].sort((a, b) => b.rest - a.rest || a.index - b.index)) {
    if (spare <= 0) break;
    share.whole += 1;
    spare -= 1;
  }
  shares.forEach(({ index, whole }) =>
    prizes.set(results[index].playerId, results[index].prizeCents + whole),
  );
  return prizes;
}

export function pokerStandings(history: PokerSession[]) {
  const players = new Map<
    number,
    {
      playerId: number;
      name: string;
      /** Puntos de la liga, en centésimas para sumar sin errores de redondeo. */
      hundredths: number;
      played: number;
      rebuys: number;
      addOns: number;
      wins: number;
      podiums: number;
      cashes: number;
      applause: number;
      paid: number;
      prizes: number;
      places: number;
      /** Podios seguidos hasta el último torneo que jugó, y la mejor racha de podios. */
      streak: number;
      bestStreak: number;
    }
  >();
  // El histórico llega del más reciente al más antiguo: las rachas se cuentan en orden cronológico.
  for (const session of [...history].reverse()) {
    const { results } = session;
    const prizes = fullPrizes(session);
    // Aplauso: el primer puesto que se queda sin premio.
    const applausePlace = results.filter((result) => result.prizeCents > 0).length + 1;
    for (const result of results) {
      const row = players.get(result.playerId) ?? {
        playerId: result.playerId,
        name: result.name,
        hundredths: 0,
        played: 0,
        rebuys: 0,
        addOns: 0,
        wins: 0,
        podiums: 0,
        cashes: 0,
        applause: 0,
        paid: 0,
        prizes: 0,
        places: 0,
        streak: 0,
        bestStreak: 0,
      };
      row.played += 1;
      row.hundredths += Math.round((result.points ?? 0) * 100);
      row.rebuys += result.rebuys;
      row.addOns += result.addOns;
      row.wins += Number(result.place === 1);
      row.podiums += Number(result.place <= 3);
      row.cashes += Number(result.prizeCents > 0);
      row.applause += Number(result.place === applausePlace && result.prizeCents === 0);
      row.paid += result.paidCents;
      row.prizes += prizes.get(result.playerId) ?? result.prizeCents;
      row.places += result.place;
      row.streak = result.place <= 3 ? row.streak + 1 : 0;
      row.bestStreak = Math.max(row.bestStreak, row.streak);
      players.set(result.playerId, row);
    }
  }
  const rows = [...players.values()].map(({ hundredths, ...row }) => ({
    ...row,
    points: hundredths / 100,
  }));
  type Row = (typeof rows)[number];
  const byMerit = (a: Row, b: Row) =>
    b.points - a.points ||
    b.wins - a.wins ||
    b.podiums - a.podiums ||
    a.places / a.played - b.places / b.played;
  // El nombre solo ordena la lista: quien empata en todo lo demás comparte puesto (1, 1, 3…).
  const sorted = rows.sort((a, b) => byMerit(a, b) || a.name.localeCompare(b.name, 'es'));
  let rank = 0;
  return sorted.map((row, index) => {
    if (index === 0 || byMerit(sorted[index - 1], row) !== 0) rank = index + 1;
    return { ...row, rank };
  });
}

/** Jugadores por torneo: el mismo tope que el servidor. */
export const POKER_MAX_ENTRIES = 100;
