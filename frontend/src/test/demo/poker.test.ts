import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoResponse, type DemoData } from '../../demo/backend';
import { DEMO_LEAGUES } from '../../demo/mode';
import { POKER_ID, withPoker } from '../../demo/poker';
import type { PokerLeagueData, PokerSession } from '../../services/endpoints/poker';

const NOW = Date.parse('2026-11-27T21:30:00Z');

function sample(): DemoData {
  return {
    recordedAt: '2026-11-17T03:00:00.000Z',
    exact: {
      '/users/me': { userId: 105, participantName: 'Marta' },
      '/groups/mine': [{ id: 6, name: 'LaLiga de la oficina', kind: 'POOL', memberCount: 12 }],
      '/groups/mine/summary': [{ groupId: 6, rank: 2 }],
      '/groups/6/members': [
        { userId: 101, participantName: 'Dani', avatarUrl: null, admin: false },
      ],
    },
    voters: {},
    participants: {},
  };
}

describe('liga de póker de la demo', () => {
  afterEach(() => vi.useRealTimers());

  it('se puede abrir por enlace desde la demo', () => {
    expect(DEMO_LEAGUES.find((league) => league.slug === 'poker')?.id).toBe(String(POKER_ID));
  });

  it('aparece entre las ligas de la participante, con sus miembros', () => {
    const data = withPoker(sample(), NOW);
    const mine = data.exact['/groups/mine'] as { id: number; kind: string; memberCount: number }[];
    expect(mine.map((group) => group.id)).toEqual([6, POKER_ID]);
    expect(mine[1]).toMatchObject({ kind: 'POKER', name: 'Póker de la peña', memberCount: 12 });
    expect(data.exact[`/groups/${POKER_ID}`]).toEqual(mine[1]);
    expect(data.exact['/groups/mine/summary']).toHaveLength(2);

    const members = data.exact[`/groups/${POKER_ID}/members`] as { userId: number }[];
    expect(members).toHaveLength(9);
    expect(members.find((member) => member.userId === 101)).toMatchObject({
      participantName: 'Dani',
      admin: false,
    });
    // Los datos de partida no se tocan, y añadirla dos veces no la duplica.
    expect(sample().exact['/groups/mine']).toHaveLength(1);
    expect(withPoker(data, NOW)).toBe(data);
  });

  it('trae un torneo en juego y seis cerrados con premios que cuadran', () => {
    const data = withPoker(sample(), NOW);
    const league = data.exact[`/poker/${POKER_ID}`] as PokerLeagueData;
    const current = league.current!;
    expect(current.closedAt).toBeNull();
    expect(current.clock).toMatchObject({ level: 2, endsAt: NOW + current.clock!.remainingMs });
    expect(current.settings.levels[current.clock!.level]).toMatchObject({ small: 75, big: 150 });
    expect(current.eliminations).toHaveLength(2);
    expect(league.players.every((player) => player.userId && player.userId > 100)).toBe(true);
    expect(league.myPlayerId).toBe(league.players.find((p) => p.name === 'Marta')?.id);

    const history = data.exact[`/poker/${POKER_ID}/history`] as PokerSession[];
    expect(history).toHaveLength(6);
    const starts = history.map((session) => session.startedAt!);
    expect([...starts].sort((a, b) => b - a)).toEqual(starts);
    for (const session of history) {
      expect(session.startedAt).toBeLessThan(NOW);
      expect(session.closedAt! - session.startedAt!).toBeLessThan(6 * 3600_000);
      const paid = session.results.reduce((sum, result) => sum + result.paidCents, 0);
      const prizes = session.results.reduce((sum, result) => sum + result.prizeCents, 0);
      expect(paid).toBe(session.potCents);
      expect(prizes + session.leftoverCents!).toBe(session.potCents);
      expect(session.results.map((result) => result.place)).toEqual(
        session.results.map((_, index) => index + 1),
      );
    }
  });

  it('responde con la hora del momento, para que el reloj de ciegas no salte', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW + 60_000);
    const data = withPoker(sample(), NOW);
    const league = (await demoResponse(
      data,
      'GET',
      `/poker/${POKER_ID}`,
    ).json()) as PokerLeagueData;
    expect(league.serverNow).toBe(NOW + 60_000);
    expect(league.current?.clock?.endsAt).toBe(
      (data.exact[`/poker/${POKER_ID}`] as PokerLeagueData).current?.clock?.endsAt,
    );
    const music = await demoResponse(data, 'GET', `/poker/${POKER_ID}/music`).json();
    expect(music).toEqual({ organizer: true, searchAvailable: true, items: [] });
  });
});
