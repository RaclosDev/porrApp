import { describe, it, expect } from 'vitest';
import {
  normalizeCountryName,
  getCountryCode,
  getCountryEmoji,
  fixMojibake,
  normalizeParticipantName,
} from '../../utils/constants';

describe('constants country normalization and flags', () => {
  it('normalizes corrupted names and mojibake to standard Spanish names', () => {
    expect(normalizeCountryName('Espa??a')).toBe('España');
    expect(normalizeCountryName('Espaa')).toBe('España');
    expect(normalizeCountryName('EspaÃ±a')).toBe('España');
    expect(normalizeCountryName('M??xico')).toBe('México');
    expect(normalizeCountryName('Canad??')).toBe('Canadá');
    expect(normalizeCountryName('Pa??ses Bajos')).toBe('Países Bajos');
  });

  it('correctly maps country codes even if name is corrupted or unaccented', () => {
    expect(getCountryCode('España')).toBe('es');
    expect(getCountryCode('Espa??a')).toBe('es');
    expect(getCountryCode('Espaa')).toBe('es');
    expect(getCountryCode('Espana')).toBe('es');
    expect(getCountryCode('Spain')).toBe('es');
    expect(getCountryCode('M??xico')).toBe('mx');
    expect(getCountryCode('Estados Unidos')).toBe('us');
    expect(getCountryCode('EE.UU.')).toBe('us');
    expect(getCountryCode('República Democrática del Congo')).toBe('cd');
    expect(getCountryCode('R.D. Congo')).toBe('cd');
    expect(getCountryCode('Corea Sur')).toBe('kr');
    expect(getCountryCode('Czech Republic')).toBe('cz');
  });

  it('generates the Spanish flag emoji even with corrupted input', () => {
    expect(getCountryEmoji('Espa??a')).toBe('🇪🇸');
    expect(getCountryEmoji('España')).toBe('🇪🇸');
  });

  it('replaces common Mojibake UTF-8 sequences', () => {
    expect(fixMojibake('EspaÃ±a')).toBe('España');
    expect(fixMojibake('JosÃ©')).toBe('José');
    expect(fixMojibake('Ãngel')).toBe('Ángel');
    expect(fixMojibake('RaÃºl')).toBe('Raúl');
  });

  it('normalizes corrupted participant names', () => {
    expect(normalizeParticipantName('An??nimo')).toBe('Anónimo');
    expect(normalizeParticipantName('Ra??l')).toBe('Raúl');
    expect(normalizeParticipantName('Jos??')).toBe('José');
    expect(normalizeParticipantName('JosÃ©')).toBe('José');
    expect(normalizeParticipantName('Carlos')).toBe('Carlos');
  });
});
