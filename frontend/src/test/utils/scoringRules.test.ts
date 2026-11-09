import { describe, expect, it } from 'vitest';
import {
  draftToRules,
  sameRules,
  scoringSections,
  scoringValueError,
  toDraft,
} from '../../utils/scoringRules';
import { DEFAULT_SCORING } from '../fixtures';

const keysOf = (format: Parameters<typeof scoringSections>[0], pichichi: boolean) =>
  scoringSections(format, pichichi).flatMap((section) => section.fields.map((field) => field.key));

describe('scoringRules', () => {
  it('en la NFL cada partido solo puntúa el ganador', () => {
    expect(
      scoringSections('MATCH_DAY', false, false, false, true).flatMap((s) =>
        s.fields.map((f) => f.key),
      ),
    ).toEqual(['correctSignPoints']);
  });

  it('lo del empate de la NFL solo se cuenta en la NFL', () => {
    const hint = (sport: 'AMERICAN_FOOTBALL' | 'BASKETBALL') =>
      scoringSections('MATCH_DAY', false, false, false, true, sport)[0].fields[0].hint;
    expect(hint('AMERICAN_FOOTBALL')).toBe(
      'Aciertas quién gana el partido. Si acaba en empate, no suma nadie.',
    );
    // El baloncesto y las competiciones propias sin empate (LoL, UFC…) no hablan de otro deporte.
    expect(hint('BASKETBALL')).toBe('Aciertas quién gana el partido.');
  });

  it('en el LoL cada serie puntúa el ganador y el resultado, y superviviente no tiene empate', () => {
    const keys = (format: 'MATCH_DAY' | 'SURVIVOR') =>
      scoringSections(format, false, false, false, true, 'LEAGUE_OF_LEGENDS').flatMap((s) =>
        s.fields.map((f) => f.key),
      );
    expect(keys('MATCH_DAY')).toEqual(['correctSignPoints', 'exactScorePoints']);
    expect(keys('SURVIVOR')).not.toContain('survivorDrawSurvives');
    expect(keys('SURVIVOR')).toContain('survivorLives');
  });

  it('cada formato muestra sus reglas', () => {
    expect(keysOf('MATCH_DAY', true)).toEqual([
      'exactScorePoints',
      'correctSignPoints',
      'goalDiffBonusPoints',
    ]);
    expect(keysOf('FULL_BRACKET', true)).toContain('groupQualifierPoints');
    expect(keysOf('FULL_BRACKET', true)).toContain('topScorerPoints');
    expect(keysOf('FULL_BRACKET', false)).not.toContain('topScorerPoints');
    expect(keysOf('KNOCKOUTS_ONLY', true)).not.toContain('groupQualifierPoints');
    expect(keysOf('KNOCKOUTS_ONLY', true)).toContain('roundOf32Points');
    // Sin formato conocido se tratan como cuadro completo.
    expect(keysOf(null, false)).toEqual(keysOf('FULL_BRACKET', false));
    expect(keysOf('GRAND_PRIX', true)).toEqual([
      'f1ExactPositionPoints',
      'f1PodiumPoints',
      'f1PolePoints',
      'f1FastestLapPoints',
    ]);
  });

  it('un torneo que empieza en octavos no tiene regla de dieciseisavos ni, sin su partido, de tercer puesto', () => {
    const keys = (tournament?: Parameters<typeof scoringSections>[7]) =>
      scoringSections('FULL_BRACKET', true, false, false, false, null, false, tournament).flatMap(
        (section) => section.fields.map((field) => field.key),
      );
    const euro = keys({ firstRound: 'r16', thirdPlaceMatch: false });
    expect(euro).toEqual([
      'groupQualifierPoints',
      'groupExactPositionPoints',
      'roundOf16Points',
      'quarterFinalPoints',
      'semiFinalPoints',
      'championPoints',
      'runnerUpPoints',
      'topScorerPoints',
    ]);
    // El Mundial, y una liga que no dice sus rondas, conservan todas sus reglas.
    expect(keys({ firstRound: 'r32', thirdPlaceMatch: true })).toEqual(keys());
    expect(keys()).toEqual(keysOf('FULL_BRACKET', true));
    expect(keys()).toContain('roundOf32Points');
    expect(keys()).toContain('fourthPlacePoints');
  });

  it('los playoffs de la NBA puntúan cada serie y el extra por acertar en cuántos partidos', () => {
    const nba = scoringSections('KNOCKOUTS_ONLY', false, true, true).flatMap((section) =>
      section.fields.map((field) => field.key),
    );
    expect(nba).toContain('nbaPlayInPoints');
    expect(nba).toContain('nbaFinalsExactPoints');
    expect(nba).not.toContain('roundOf16Points');
  });

  it('las reglas del cuadro, las de jornadas, las de peleas, las de superviviente, las de la NBA y las de Fórmula 1 cubren todas las del backend', () => {
    const shown = new Set([
      ...keysOf('FULL_BRACKET', true),
      ...keysOf('MATCH_DAY', true),
      ...scoringSections('MATCH_DAY', false, false, false, false, null, true).flatMap((section) =>
        section.fields.map((field) => field.key),
      ),
      ...keysOf('SURVIVOR', false),
      ...keysOf('GRAND_PRIX', false),
      ...scoringSections('KNOCKOUTS_ONLY', false, true, true).flatMap((section) =>
        section.fields.map((field) => field.key),
      ),
    ]);
    expect([...shown].sort()).toEqual(Object.keys(DEFAULT_SCORING).sort());
  });

  it('solo admite enteros entre 0 y el máximo', () => {
    expect(scoringValueError('0', 1000)).toBeNull();
    expect(scoringValueError(' 1000 ', 1000)).toBeNull();
    expect(scoringValueError('1001', 1000)).toBe('Como máximo 1000.');
    for (const value of ['', '-1', '2.5', '1e3', 'diez']) {
      expect(scoringValueError(value, 1000)).toBe('Escribe un número entero, 0 o más.');
    }
  });

  it('convierte el borrador en reglas y compara reglas', () => {
    const draft = { ...toDraft(DEFAULT_SCORING), championPoints: '300' };

    expect(draftToRules(draft, 1000)).toEqual({ ...DEFAULT_SCORING, championPoints: 300 });
    expect(draftToRules({ ...draft, runnerUpPoints: '' }, 1000)).toBeNull();
    expect(sameRules(DEFAULT_SCORING, { ...DEFAULT_SCORING })).toBe(true);
    expect(sameRules(DEFAULT_SCORING, { ...DEFAULT_SCORING, goalDiffBonusPoints: 0 })).toBe(false);
  });
});
