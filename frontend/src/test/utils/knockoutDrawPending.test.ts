import { describe, expect, it } from 'vitest';
import {
  hasLeaguePhase,
  isKnockoutOnlyCup,
  knockoutDrawPendingText,
} from '../../utils/knockoutDrawPending';

describe('knockoutDrawPending', () => {
  it('la Champions espera a su fase de liga y la Copa del Rey a los dieciseisavos', () => {
    expect(hasLeaguePhase('uefa.europa')).toBe(true);
    expect(knockoutDrawPendingText('uefa.champions')).toMatch(/fase de liga/);
    expect(knockoutDrawPendingText('esp.copa_del_rey')).toMatch(/dieciseisavos/);
    expect(knockoutDrawPendingText(null)).toMatch(/Aún no se han sorteado/);
  });

  it('solo la copa sin fase de grupos se queda sin tabla', () => {
    expect(isKnockoutOnlyCup('esp.copa_del_rey')).toBe(true);
    expect(isKnockoutOnlyCup('conmebol.libertadores')).toBe(false);
    expect(isKnockoutOnlyCup('fifa.world')).toBe(false);
  });
});
