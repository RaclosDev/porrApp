/**
 * Liga de póker de la demo. Las ligas de la demo salen de ligas reales anonimizadas y ninguna es de
 * póker, así que esta se inventa aquí: los mismos participantes ficticios (y fotos) que las otras
 * ligas, un torneo en juego esta noche y un histórico de torneos cerrados. Las fechas van siempre
 * referidas al momento en que se cargan los datos.
 */
import type {
  BlindLevel,
  PokerLeagueData,
  PokerPlayer,
  PokerSession,
  PokerSettings,
} from '../services/endpoints/poker';
import type { DemoData } from './backend';

export const POKER_ID = 77;
const NAME = 'Póker de la peña';
const JOIN_CODE = 'POKER26';

const DAY_MS = 24 * 3600 * 1000;
const MINUTE_MS = 60 * 1000;

/** Participantes de la demo (ids 101+): `withAvatars` pone la foto de cada uno a partir de `userId`. */
const PEOPLE: [number, string][] = [
  [105, 'Marta'],
  [101, 'Dani'],
  [102, 'Noa'],
  [103, 'Alba'],
  [104, 'Marcos'],
  [106, 'Sara'],
  [107, 'Leo'],
  [108, 'Nico'],
  [110, 'Toni'],
];
const PLAYERS: PokerPlayer[] = PEOPLE.map(([userId, name], index) => ({
  id: 9001 + index,
  name,
  guest: false,
  userId,
  avatarUrl: null,
}));
const playerId = (name: string) => PLAYERS.find((player) => player.name === name)!.id;

const LEVELS: BlindLevel[] = (
  [
    [25, 50, 0],
    [50, 100, 0],
    [75, 150, 0],
    [100, 200, 25],
    [150, 300, 25],
    [200, 400, 50],
    [300, 600, 75],
    [400, 800, 100],
    [600, 1200, 150],
    [800, 1600, 200],
    [1000, 2000, 300],
    [1500, 3000, 400],
  ] as const
).map(([small, big, ante]) => ({ minutes: 15, small, big, ante }));

const SETTINGS: PokerSettings = {
  buyInCents: 1000,
  startingChips: 10000,
  rebuy: { costCents: 1000, chips: 10000, limit: 2, throughLevel: 4 },
  addOn: null,
  prizeShares: [50, 30, 20],
  prizeAmounts: null,
  levels: LEVELS,
  pactPoints: 'EQUAL',
  roundingCents: 100,
  prizePoints: [5, 3, 1],
};
const PRIZE_POINTS = SETTINGS.prizePoints ?? [];

type Seat = [name: string, rebuys: number];

const entry = ([name, rebuys]: Seat) => ({ playerId: playerId(name), name, rebuys, addOns: 0 });
const paid = (rebuys: number) => SETTINGS.buyInCents * (1 + rebuys);
const potOf = (seats: Seat[]) => seats.reduce((sum, [, rebuys]) => sum + paid(rebuys), 0);

/** Torneo cerrado hace `daysAgo` días; `order` va del ganador al primero en caer. */
function closed(id: number, daysAgo: number, order: Seat[], now: number): PokerSession {
  const entries = order.map(entry);
  const pot = potOf(order);
  const prizes = SETTINGS.prizeShares.map((share) => Math.round((pot * share) / 100 / 100) * 100);
  const day = new Date(now - daysAgo * DAY_MS);
  day.setHours(22, 0, 0, 0);
  const startedAt = day.getTime();
  return {
    id,
    revision: 40,
    date: day.toISOString().slice(0, 10),
    startedAt,
    closedAt: startedAt + (190 + (id % 100) * 7) * MINUTE_MS,
    settings: SETTINGS,
    entries,
    eliminations: entries
      .map((item) => item.playerId)
      .reverse()
      .slice(0, -1),
    clock: null,
    potCents: pot,
    prizes,
    results: entries.map((item, index) => ({
      ...item,
      finalChips: null,
      place: index + 1,
      paidCents: paid(item.rebuys),
      prizeCents: prizes[index] ?? 0,
      points: PRIZE_POINTS[index] ?? 0,
    })),
    leftoverCents: pot - prizes.reduce((sum, prize) => sum + prize, 0),
  };
}

/** Los torneos cerrados, uno por semana, del más reciente al más antiguo. */
function pokerHistory(now: number): PokerSession[] {
  const weeks: Seat[][] = [
    [
      ['Marta', 0],
      ['Dani', 1],
      ['Alba', 0],
      ['Leo', 1],
      ['Noa', 0],
      ['Marcos', 2],
      ['Nico', 0],
      ['Sara', 1],
    ],
    [
      ['Dani', 0],
      ['Noa', 1],
      ['Marta', 0],
      ['Sara', 0],
      ['Toni', 1],
      ['Alba', 1],
      ['Leo', 0],
    ],
    [
      ['Alba', 1],
      ['Marta', 0],
      ['Marcos', 0],
      ['Dani', 2],
      ['Nico', 1],
      ['Noa', 0],
      ['Sara', 0],
      ['Toni', 0],
    ],
    [
      ['Marta', 1],
      ['Leo', 0],
      ['Dani', 0],
      ['Noa', 1],
      ['Alba', 0],
      ['Nico', 0],
    ],
    [
      ['Noa', 0],
      ['Sara', 1],
      ['Dani', 1],
      ['Marta', 0],
      ['Marcos', 1],
      ['Leo', 2],
      ['Toni', 0],
      ['Alba', 0],
    ],
    [
      ['Dani', 1],
      ['Marta', 0],
      ['Toni', 0],
      ['Alba', 0],
      ['Noa', 1],
      ['Sara', 0],
      ['Nico', 0],
    ],
  ];
  return weeks.map((order, index) => closed(306 - index, 7 * (index + 1), order, now));
}

/** Torneo de esta noche, en juego: nivel 3, dos eliminados y unas cuantas recompras. */
function live(now: number): PokerSession {
  const seats: Seat[] = [
    ['Marta', 0],
    ['Dani', 1],
    ['Noa', 0],
    ['Alba', 1],
    ['Marcos', 0],
    ['Sara', 0],
    ['Leo', 2],
    ['Nico', 0],
  ];
  const remainingMs = 8 * MINUTE_MS + 56 * 1000;
  return {
    id: 307,
    revision: 31,
    date: new Date(now).toISOString().slice(0, 10),
    startedAt: now - (2 * 15 + 6) * MINUTE_MS,
    closedAt: null,
    settings: SETTINGS,
    entries: seats.map(entry),
    eliminations: [playerId('Nico'), playerId('Sara')],
    clock: { level: 2, endsAt: now + remainingMs, remainingMs },
    potCents: potOf(seats),
    prizes: [],
    results: [],
  };
}

/** La liga tal y como la devuelve /poker/{id}; quien visita la demo la organiza. */
function pokerLeague(now: number): PokerLeagueData {
  const current = live(now);
  return {
    id: POKER_ID,
    name: NAME,
    joinCode: JOIN_CODE,
    owner: true,
    admin: true,
    everyoneOrganizes: false,
    myPlayerId: playerId('Marta'),
    players: PLAYERS,
    current,
    upcoming: [current],
    serverNow: now,
  };
}

/** Añade la liga de póker a los datos de la demo: lista de ligas, ficha, miembros y póker. */
export function withPoker(data: DemoData, now: number): DemoData {
  const exact = data.exact;
  const mine = (exact['/groups/mine'] ?? []) as Record<string, unknown>[];
  if (mine.some((group) => group.id === POKER_ID)) return data;
  // La ficha de una liga de verdad de la demo, con lo propio de una de póker.
  const template = mine.find((group) => group.id === 6) ?? mine[0] ?? {};
  const group = {
    ...template,
    id: POKER_ID,
    name: NAME,
    kind: 'POKER',
    competitionId: null,
    competitionName: null,
    competitionExternalId: null,
    poolFormat: null,
    formatType: null,
    imageUrl: null,
    joinCode: JOIN_CODE,
    adminUserId: 105,
    adminUserIds: [105],
    adminParticipantName: 'Marta',
  };
  const summary = exact['/groups/mine/summary'];
  const members = (exact['/groups/6/members'] ?? []) as { userId: number }[];
  return {
    ...data,
    exact: {
      ...exact,
      '/groups/mine': [...mine, group],
      ...(Array.isArray(summary) && {
        '/groups/mine/summary': [
          ...summary,
          {
            groupId: POKER_ID,
            rank: null,
            points: null,
            participants: PLAYERS.length,
            pendingPredictions: 0,
            finished: false,
          },
        ],
      }),
      [`/groups/${POKER_ID}`]: group,
      [`/groups/${POKER_ID}/members`]: PEOPLE.map(([userId, name]) => ({
        ...members.find((member) => member.userId === userId),
        userId,
        participantName: name,
        avatarUrl: null,
      })),
      [`/poker/${POKER_ID}`]: pokerLeague(now),
      [`/poker/${POKER_ID}/history`]: pokerHistory(now),
      [`/poker/${POKER_ID}/music`]: { organizer: true, searchAvailable: true, items: [] },
    },
  };
}
