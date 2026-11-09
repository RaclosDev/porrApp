import { describe, expect, it } from 'vitest';
import type { ScorerCandidate } from '../../types/api';
import { findPlayer, suggestPlayers } from '../../utils/scorerPicks';

const player = (name: string, team: string, goals = 0, playerId = name): ScorerCandidate => ({
  playerId,
  name,
  shortName: name,
  team,
  position: 'F',
  goals,
});

const PLAYERS = [
  player('Kylian Mbappé', 'Real Madrid', 12),
  player('Robert Lewandowski', 'Barcelona', 9),
  player('Gonçalo Ramos', 'Paris Saint-Germain', 3),
  player('Sergio Ramos', 'Sevilla', 1),
  player('Vinícius Júnior', 'Real Madrid', 8),
];

describe('pichichi: jugadores de la lista', () => {
  it('encuentra al jugador sin fijarse en tildes, mayúsculas ni espacios de más', () => {
    expect(findPlayer(PLAYERS, 'kylian   MBAPPE')?.name).toBe('Kylian Mbappé');
    expect(findPlayer(PLAYERS, 'Vinicius Junior')?.name).toBe('Vinícius Júnior');
  });

  it('no elige si lo escrito no es un nombre exacto o encaja con varios', () => {
    expect(findPlayer(PLAYERS, 'Ramos')).toBeNull();
    expect(findPlayer(PLAYERS, 'Mbape')).toBeNull();
    expect(findPlayer(PLAYERS, '   ')).toBeNull();
    const twins = [player('Rafa Silva', 'Benfica', 1, 'a'), player('Rafa Silva', 'Braga', 1, 'b')];
    expect(findPlayer(twins, 'Rafa Silva')).toBeNull();
  });

  it('propone a quien lleva todas las palabras escritas, antes a quien las empieza y con más goles', () => {
    expect(suggestPlayers(PLAYERS, 'ramos').map((item) => item.name)).toEqual([
      'Gonçalo Ramos',
      'Sergio Ramos',
    ]);
    expect(suggestPlayers(PLAYERS, 'madrid')).toEqual([]);
    expect(suggestPlayers(PLAYERS, 'junior vini')[0].name).toBe('Vinícius Júnior');
    // Una parte en medio del nombre sirve, pero detrás de los que empiezan por ella.
    expect(suggestPlayers(PLAYERS, 'ert').map((item) => item.name)).toEqual(['Robert Lewandowski']);
  });

  it('sin nada escrito enseña a los máximos goleadores, con un tope', () => {
    expect(suggestPlayers(PLAYERS, '', 2).map((item) => item.name)).toEqual([
      'Kylian Mbappé',
      'Robert Lewandowski',
    ]);
  });
});
