// Liga de póker para las capturas. La demo pública no trae ninguna, así que `capture.mjs` la añade a
// /demo-data.json antes de que la cargue la aplicación: mismos participantes ficticios (y fotos) que
// las otras ligas de la demo, un torneo en juego y un histórico de torneos ya cerrados.

export const POKER_ID = 77;

const DAY = 24 * 3600 * 1000;
const MINUTE = 60 * 1000;

/** Participantes de la demo (ids 101+): la demo pone la foto de cada uno a partir de `userId`. */
const PEOPLE = [
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
const players = PEOPLE.map(([userId, name], index) => ({
  id: 9001 + index,
  name,
  guest: false,
  userId,
  avatarUrl: null,
}));
const byName = Object.fromEntries(players.map((player) => [player.name, player]));

const LEVELS = [
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
].map(([small, big, ante]) => ({ minutes: 15, small, big, ante }));

const SETTINGS = {
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

const entry = (name, rebuys = 0) => ({
  playerId: byName[name].id,
  name,
  rebuys,
  addOns: 0,
});
const potOf = (entries) =>
  entries.reduce((sum, item) => sum + SETTINGS.buyInCents * (1 + item.rebuys), 0);

/** Torneo cerrado: `order` va del ganador al primero en caer, con las recompras de cada uno. */
function closed(id, daysAgo, order, now) {
  const entries = order.map(([name, rebuys]) => entry(name, rebuys));
  const pot = potOf(entries);
  const prizes = SETTINGS.prizeShares.map((share) => Math.round((pot * share) / 100 / 100) * 100);
  const day = new Date(now - daysAgo * DAY);
  day.setHours(22, 0, 0, 0);
  const startedAt = day.getTime();
  return {
    id,
    revision: 40,
    date: day.toISOString().slice(0, 10),
    startedAt,
    closedAt: startedAt + (190 + id * 7) * MINUTE,
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
      paidCents: SETTINGS.buyInCents * (1 + item.rebuys),
      prizeCents: prizes[index] ?? 0,
      points: SETTINGS.prizePoints[index] ?? 0,
    })),
    leftoverCents: pot - prizes.reduce((sum, prize) => sum + prize, 0),
  };
}

export function pokerHistory(now = Date.now()) {
  return [
    closed(
      306,
      7,
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
      now,
    ),
    closed(
      305,
      14,
      [
        ['Dani', 0],
        ['Noa', 1],
        ['Marta', 0],
        ['Sara', 0],
        ['Toni', 1],
        ['Alba', 1],
        ['Leo', 0],
      ],
      now,
    ),
    closed(
      304,
      21,
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
      now,
    ),
    closed(
      303,
      28,
      [
        ['Marta', 1],
        ['Leo', 0],
        ['Dani', 0],
        ['Noa', 1],
        ['Alba', 0],
        ['Nico', 0],
      ],
      now,
    ),
    closed(
      302,
      35,
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
      now,
    ),
    closed(
      301,
      42,
      [
        ['Dani', 1],
        ['Marta', 0],
        ['Toni', 0],
        ['Alba', 0],
        ['Noa', 1],
        ['Sara', 0],
        ['Nico', 0],
      ],
      now,
    ),
  ];
}

/** Torneo de esta noche, en juego: nivel 3, dos eliminados y unas cuantas recompras. */
function live(now) {
  const entries = [
    entry('Marta', 0),
    entry('Dani', 1),
    entry('Noa', 0),
    entry('Alba', 1),
    entry('Marcos', 0),
    entry('Sara', 0),
    entry('Leo', 2),
    entry('Nico', 0),
  ];
  const level = 2;
  const remainingMs = 8 * MINUTE + 56 * 1000;
  return {
    id: 307,
    revision: 31,
    date: new Date(now).toISOString().slice(0, 10),
    startedAt: now - (2 * 15 + 6) * MINUTE,
    closedAt: null,
    settings: SETTINGS,
    entries,
    eliminations: [byName.Nico.id, byName.Sara.id],
    clock: { level, endsAt: now + remainingMs, remainingMs },
    potCents: potOf(entries),
    prizes: [],
    results: [],
  };
}

export function pokerLeague(now = Date.now()) {
  const current = live(now);
  return {
    id: POKER_ID,
    name: 'Póker de la peña',
    joinCode: 'POKER26',
    owner: true,
    admin: true,
    myPlayerId: byName.Marta.id,
    players,
    current,
    upcoming: [current],
    serverNow: now,
  };
}

/** Añade la liga de póker a los datos de la demo (lista de ligas, ficha, miembros y póker). */
export function withPoker(data, now = Date.now()) {
  const exact = data.exact;
  const template = exact['/groups/mine'].find((group) => group.id === 6);
  const group = {
    ...template,
    id: POKER_ID,
    name: 'Póker de la peña',
    kind: 'POKER',
    competitionId: null,
    competitionName: null,
    competitionExternalId: null,
    poolFormat: null,
    formatType: null,
    imageUrl: null,
    joinCode: 'POKER26',
    adminUserId: 105,
    adminUserIds: [105],
    adminParticipantName: 'Marta',
  };
  exact['/groups/mine'] = [...exact['/groups/mine'], group];
  const summary = exact['/groups/mine/summary'];
  if (Array.isArray(summary)) {
    exact['/groups/mine/summary'] = [
      ...summary,
      {
        groupId: POKER_ID,
        rank: null,
        points: null,
        participants: players.length,
        pendingPredictions: 0,
        finished: false,
      },
    ];
  }
  exact[`/groups/${POKER_ID}`] = group;
  const members = exact['/groups/6/members'] ?? [];
  exact[`/groups/${POKER_ID}/members`] = PEOPLE.map(([userId, name]) => ({
    ...(members.find((member) => member.userId === userId) ?? {}),
    userId,
    participantName: name,
    avatarUrl: null,
  }));
  exact[`/poker/${POKER_ID}`] = pokerLeague(now);
  exact[`/poker/${POKER_ID}/history`] = pokerHistory(now);
  return data;
}
