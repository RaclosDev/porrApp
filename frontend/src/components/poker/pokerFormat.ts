import type {
  BlindClock,
  BlindLevel,
  PokerSession,
  PokerSettings,
} from '../../services/endpoints/poker';

const moneyFormat = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const dateFormat = new Intl.DateTimeFormat('es-ES', { dateStyle: 'full' });
const numberFormat = new Intl.NumberFormat('es-ES');
const percentFormat = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  maximumFractionDigits: 1,
});

export const euros = (cents: number) => moneyFormat.format(cents / 100);
export const chips = (count: number) => numberFormat.format(count);
export const percent = (value: number) => percentFormat.format(value);
export const tournamentDate = (date: string) => dateFormat.format(new Date(`${date}T12:00:00`));

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
    { small: 0, big: 0, ante: 0, minutes: 10 },
    { small: 150, big: 300, ante: 0, minutes: 15 },
    { small: 200, big: 400, ante: 0, minutes: 15 },
    { small: 300, big: 600, ante: 0, minutes: 15 },
    { small: 400, big: 800, ante: 0, minutes: 15 },
    { small: 600, big: 1200, ante: 0, minutes: 15 },
    { small: 1000, big: 2000, ante: 0, minutes: 15 },
    { small: 1500, big: 3000, ante: 0, minutes: 15 },
    { small: 2000, big: 4000, ante: 0, minutes: 15 },
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
      wins: number;
      podiums: number;
      cashes: number;
      paid: number;
      prizes: number;
      places: number;
    }
  >();
  for (const { results } of history) {
    for (const result of results) {
      const row = players.get(result.playerId) ?? {
        playerId: result.playerId,
        name: result.name,
        played: 0,
        wins: 0,
        podiums: 0,
        cashes: 0,
        paid: 0,
        prizes: 0,
        places: 0,
      };
      row.played += 1;
      row.wins += Number(result.place === 1);
      row.podiums += Number(result.place <= 3);
      row.cashes += Number(result.prizeCents > 0);
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
