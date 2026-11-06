import { describe, expect, it } from 'vitest';
import { teamKey } from '../../utils/teamKey';

describe('teamKey', () => {
  it('drops the characters the backend removes from standings keys', () => {
    expect(teamKey('Bosnia y Her.')).toBe('Bosnia y Her');
    expect(teamKey('A#B$C[D]')).toBe('ABCD');
    expect(teamKey('España')).toBe('España');
  });
});
