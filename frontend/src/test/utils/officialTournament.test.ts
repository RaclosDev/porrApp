import { describe, expect, it } from 'vitest';
import {
  computeOfficialResultRounds,
  computeSwissStandings,
  nextOfficialBracketMatch,
  officialBracketMatches,
  officialMatchWinner,
} from '../../utils/officialTournament';
import type { Match } from '../../types/api';

let nextId = 1;
function match(fields: Partial<Match>): Match {
  return {
    id: nextId++,
    home_team_id: 1,
    away_team_id: 2,
    finished: false,
    homeScore: null,
    awayScore: null,
    winner: null,
    groupName: null,
    date: null,
    round: 'group',
    ...fields,
  } as Match;
}

const played = (
  home: string,
  away: string,
  homeScore: number,
  awayScore: number,
  round: string,
  date: string | null = null,
) => match({ home, away, homeScore, awayScore, finished: true, round, date });

describe('cuadro de una competición oficial con series propias', () => {
  const quarters = [
    played('IG', 'TOP', 3, 2, 'qf', '2026-10-30T10:00:00Z'),
    played('Gen.G', 'LYON', 3, 0, 'qf', '2026-10-31T10:00:00Z'),
    played('DK', 'BLG', 1, 3, 'qf', '2026-11-01T10:00:00Z'),
    match({ home: 'T1', away: 'KC', round: 'qf', date: '2026-11-02T10:00:00Z' }),
  ];

  it('empieza en cuartos con los equipos reales y deja semis y final por decidir', () => {
    const rounds = computeOfficialResultRounds([...quarters, played('A', 'B', 1, 0, 'group')]);

    expect(rounds.map((round) => round.title)).toEqual([
      'Cuartos de final',
      'Semifinales',
      'Final',
    ]);
    expect(rounds[0].slots.map((slot) => [slot.home, slot.away])).toEqual([
      ['IG', 'TOP'],
      ['Gen.G', 'LYON'],
      ['DK', 'BLG'],
      ['T1', 'KC'],
    ]);
    expect(rounds[1].slots.map((slot) => [slot.homePlaceholder, slot.awayPlaceholder])).toEqual([
      ['IG', 'Gen.G'],
      ['BLG', 'Ganador C4'],
    ]);
    expect(rounds[2].slots[0].homePlaceholder).toBe('Ganador C1');
  });

  it('coloca cada semifinal junto a los cuartos de los que salen sus equipos', () => {
    const semi = match({ home: 'BLG', away: 'T1', round: 'sf' });
    const rounds = computeOfficialResultRounds([...quarters, semi]);

    expect(rounds[1].slots[0].match).toBeNull();
    expect(rounds[1].slots[1].match).toBe(semi);
  });

  it('no monta cuadro sin eliminatorias', () => {
    expect(computeOfficialResultRounds([played('A', 'B', 1, 0, 'group')])).toEqual([]);
  });

  it('destaca la próxima serie del cuadro, no las de la fase previa', () => {
    const swiss = match({ home: 'A', away: 'B', date: '2026-10-01T10:00:00Z' });
    expect(nextOfficialBracketMatch([swiss, ...quarters])?.home).toBe('T1');
    expect(nextOfficialBracketMatch([swiss])).toBeNull();
  });

  it('toma el ganador del proveedor o, si falta, del marcador', () => {
    expect(officialMatchWinner(played('A', 'B', 0, 2, 'qf'))).toBe('B');
    expect(officialMatchWinner({ ...played('A', 'B', 0, 2, 'qf'), winner: 'A' })).toBe('A');
    expect(officialMatchWinner(match({ home: 'A', away: 'B' }))).toBeNull();
  });
});

describe('fase suiza', () => {
  it('cuenta victorias y derrotas de la fase suiza sin el Play-In ni el cuadro', () => {
    const rows = computeSwissStandings([
      played('A', 'B', 1, 0, 'group'),
      played('A', 'C', 1, 0, 'group'),
      played('C', 'B', 0, 1, 'group'),
      match({ home: 'D', away: 'A', round: 'group' }),
      played('D', 'E', 1, 0, 'playin'),
      played('A', 'B', 3, 0, 'qf'),
    ]);

    expect(rows).toEqual([
      { team: 'A', wins: 2, losses: 0 },
      { team: 'B', wins: 1, losses: 1 },
      { team: 'D', wins: 0, losses: 0 },
      { team: 'C', wins: 0, losses: 2 },
    ]);
  });
});

describe('cruces oficiales para pronosticar', () => {
  it('numera las rondas desde la primera eliminatoria y ordena la primera por fecha', () => {
    const late = match({ home: 'C', away: 'D', round: 'qf', date: '2026-10-31T10:00:00Z' });
    const early = played('A', 'B', 0, 3, 'qf', '2026-10-30T10:00:00Z');
    const semi = match({ home: 'B', away: 'C', round: 'sf' });
    const result = officialBracketMatches([played('A', 'C', 1, 0, 'group'), late, semi, early]);

    expect(result.map((item) => [item.home, item.round])).toEqual([
      ['A', 'bracket-1'],
      ['C', 'bracket-1'],
      ['B', 'bracket-2'],
    ]);
    expect(result[0].winner).toBe('B');
  });
});
