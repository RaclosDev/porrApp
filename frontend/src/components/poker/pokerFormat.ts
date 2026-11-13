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

// En el podio de la liga, quien aún no ha ganado se presenta por sus podios.
export const standingLabel = ({ wins, podiums }: { wins: number; podiums: number }) =>
  wins > 0
    ? `${wins} ${wins === 1 ? 'victoria' : 'victorias'}`
    : `${podiums} ${podiums === 1 ? 'podio' : 'podios'}`;

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

export function pokerStandings(history: PokerSession[]) {
  const players = new Map<
    number,
    {
      playerId: number;
      name: string;
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
    }
  >();
  for (const { results } of history) {
    // Aplauso: el primer puesto que se queda sin premio.
    const applausePlace = results.filter((result) => result.prizeCents > 0).length + 1;
    for (const result of results) {
      const row = players.get(result.playerId) ?? {
        playerId: result.playerId,
        name: result.name,
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
      };
      row.played += 1;
      row.rebuys += result.rebuys;
      row.addOns += result.addOns;
      row.wins += Number(result.place === 1);
      row.podiums += Number(result.place <= 3);
      row.cashes += Number(result.prizeCents > 0);
      row.applause += Number(result.place === applausePlace && result.prizeCents === 0);
      row.paid += result.paidCents;
      row.prizes += result.prizeCents;
      row.places += result.place;
      players.set(result.playerId, row);
    }
  }
  return [...players.values()].sort(
    (a, b) =>
      b.wins - a.wins ||
      b.podiums - a.podiums ||
      a.places / a.played - b.places / b.played ||
      a.name.localeCompare(b.name, 'es'),
  );
}
